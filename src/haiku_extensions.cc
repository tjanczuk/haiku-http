#include <node.h>
#include <v8.h>
#include <string.h>
#include <pthread.h>
#include <unistd.h>
#include <mach/mach_init.h>
#include <mach/thread_act.h>

using namespace v8;

// Thread CPU time measurements:
// - with pthreads: http://www.kernel.org/doc/man-pages/online/pages/man3/pthread_getcpuclockid.3.html
// - on Mach: http://stackoverflow.com/questions/6788274/ios-mac-cpu-usage-for-thread

int nodeThread;
unsigned int threshold = 0;
pthread_mutex_t mutex;
Persistent<String> currentCtx;
bool watchdogActive = false;
bool inUserCode = false;
// struct timespec enterTime;
// clockid_t nodeClockId = 0;
double enterTime; // in seconds

int GetNodeThreadCPUTime(double* s) {
	if (!s)
		return -1;

	thread_info_data_t threadInfo;
	mach_msg_type_number_t count;
	if (0 != thread_info(nodeThread, THREAD_BASIC_INFO, (thread_info_t)threadInfo, &count))
		return -1;

	thread_basic_info_t basicThreadInfo = (thread_basic_info_t)threadInfo;

	if (basicThreadInfo->flags & TH_FLAGS_IDLE)
		*s = 0;
	else 
		*s = (double)(basicThreadInfo->user_time.seconds + basicThreadInfo->system_time.seconds)
			+ (double)(basicThreadInfo->user_time.microseconds + basicThreadInfo->system_time.microseconds) / 10e5;

	return 0;
}

Handle<Value> PrintNodeThreadTime(const Arguments& args) {
	double s;
	if (0 == GetNodeThreadCPUTime(&s))
		printf("GetNodeThreadTime: %f\n", s);
	else
		printf("GetNodeThreadTime: error\n");

	return Undefined();
}

Handle<Value> SetContextData(const Arguments& args) {
	HandleScope scope;

	if (!args[0]->IsString())
		return ThrowException(Exception::TypeError(String::New("The parameter must be a string.")));

	Local<Value> data = Context::GetCurrent()->GetData();

	if (!data.IsEmpty())
		return ThrowException(Exception::Error(String::New("Current context already has context data set.")));

	Context::GetCurrent()->SetData(args[0]->ToString());

	return Undefined();
}

Handle<Value> GetContextData(const Arguments& args) {
	return Context::GetCurrent()->GetData();
}

void* Watchdog(void *data) {
	unsigned int remain = threshold;
	while (true) {
		remain = sleep(remain);
		if (0 == remain) {
			pthread_mutex_lock(&mutex);
			if (inUserCode && watchdogActive) {
				// struct timespec now;
				// if (-1 != clock_gettime(nodeClockId, &now)) {
				// 	if ((now.tv_sec - enterTime.tv_sec) >= threshold) {
				// 		watchdogActive = false;
				// 		V8::TerminateExecution();
				// 	}
				// }
				double now;
				if (0 == GetNodeThreadCPUTime(&now)) {
					if ((now - enterTime) >= threshold) {
						watchdogActive = false;
						V8::TerminateExecution();
					}
				}
			}
			pthread_mutex_unlock(&mutex);
			remain = threshold;
		}
	}
	return NULL;
}

Handle<Value> StartWatchdog(const Arguments& args) {
	HandleScope scope;

	if (0 != threshold)
		return ThrowException(Exception::Error(String::New("Watchdog has already been started.")));

	if (1 != args.Length())
		return ThrowException(Exception::Error(String::New("One argument is required.")));

	if (!args[0]->IsUint32())
		return ThrowException(Exception::TypeError(String::New("First argument must be a time threshold for blocking operations in seconds.")));

	threshold = args[0]->ToUint32()->Value();

	if (0 == threshold)
		return ThrowException(Exception::Error(String::New("The time threshold for blocking operations must be greater than 0.")));

	if (/*0 != pthread_getcpuclockid(pthread_self(), &nodeClockId)
		||*/ 0 != pthread_mutex_init(&mutex, NULL) 
		|| 0 != pthread_create(NULL, NULL, Watchdog, NULL)) {
		threshold = 0;
		return ThrowException(Exception::Error(String::New("Error creating watchdog thread.")));
	}

	return Undefined();
}

Handle<Value> EnterUserCode(const Arguments& args) {
	HandleScope scope;
	int error = 0;

	if (inUserCode)
		return ThrowException(Exception::Error(String::New("Internal error. Haiku-http thinks user code is already executing.")));

	pthread_mutex_lock(&mutex);
	// if (-1 != (error = clock_gettime(nodeClockId, &enterTime))) {
	if (0 == (error = GetNodeThreadCPUTime(&enterTime))) {
		currentCtx = Persistent<String>::New(Context::GetCurrent()->GetData()->ToString());
		inUserCode = true;
		watchdogActive = true;
	}
	pthread_mutex_unlock(&mutex);

	if (error)
		return ThrowException(Exception::Error(String::New("Internal error. Unable to capture thread CPU time.")));
	else
		return Undefined();
}

Handle<Value> LeaveUserCode(const Arguments& args) {
	HandleScope scope;

	if (!inUserCode)
		return ThrowException(Exception::Error(String::New("Internal error. Haiku-http thinks no user code is executing.")));

	pthread_mutex_lock(&mutex);
	inUserCode = false;
	currentCtx.Dispose();
	currentCtx.Clear();
	pthread_mutex_unlock(&mutex);

	return Undefined();
}

extern "C"
void init(Handle<Object> target) {
	nodeThread = mach_thread_self();
	target->Set(String::NewSymbol("setContextData"), FunctionTemplate::New(SetContextData)->GetFunction());
	target->Set(String::NewSymbol("getContextData"), FunctionTemplate::New(GetContextData)->GetFunction());
	target->Set(String::NewSymbol("startWatchdog"), FunctionTemplate::New(StartWatchdog)->GetFunction());
	target->Set(String::NewSymbol("enterUserCode"), FunctionTemplate::New(EnterUserCode)->GetFunction());
	target->Set(String::NewSymbol("leaveUserCode"), FunctionTemplate::New(LeaveUserCode)->GetFunction());
	target->Set(String::NewSymbol("printNodeThreadTime"), FunctionTemplate::New(PrintNodeThreadTime)->GetFunction());
}
NODE_MODULE(haiku_extensions, init)