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

thread_t nodeThread;
unsigned int threshold = 0;
pthread_mutex_t mutex;
Persistent<String> currentCtx;
bool watchdogActive = false;
bool inUserCode = false;
int userCodeDepth = 0;
// struct timespec enterTime;
// clockid_t nodeClockId = 0;
double enterTime; // in seconds

int GetNodeThreadCPUTime(double* s) {
	if (!s)
		return -1;

	int error;
	thread_info_data_t threadInfo;
	mach_msg_type_number_t count;

	if (0 != (error = thread_info(nodeThread, THREAD_BASIC_INFO, (thread_info_t)threadInfo, &count)))
		return error;

	thread_basic_info_t basicThreadInfo = (thread_basic_info_t)threadInfo;

	if (basicThreadInfo->flags & TH_FLAGS_IDLE)
		*s = 0;
	else 
		*s = (double)(basicThreadInfo->user_time.seconds + basicThreadInfo->system_time.seconds)
			+ (double)(basicThreadInfo->user_time.microseconds + basicThreadInfo->system_time.microseconds) / 10e5;

	return 0;
}

Handle<Value> SetContextDataOn(const Arguments& args) {
	HandleScope scope;

	if (args.Length() != 2 || !args[0]->IsObject() || !args[1]->IsString())
		return ThrowException(Exception::TypeError(String::New("The first parameter must be an object and the second a string.")));

	Local<Value> data = args[0]->ToObject()->CreationContext()->GetData();

	if (data->IsString() && data->ToString() != args[1]->ToString()) {
		printf("SetContextDataOn: current data on object's creation context: %s, new data: %s\n", 
			*String::Utf8Value(data),
			*String::Utf8Value(args[1]->ToString()));
		return ThrowException(Exception::Error(String::New("Object's creation context already has a different context data set.")));
	}

	args[0]->ToObject()->CreationContext()->SetData(args[1]->ToString()); // TODO should this be a persistent handle?

	return Undefined();	
}

Handle<Value> GetContextDataOf(const Arguments& args) {
	HandleScope scope;

	if (args.Length() != 1 || !args[0]->IsObject())
		return ThrowException(Exception::TypeError(String::New("The first parameter must be an object.")));

	return args[0]->ToObject()->CreationContext()->GetData();
}

Handle<Value> EnterContextOf(const Arguments& args) {
	HandleScope scope;

	if (args.Length() != 1 || !args[0]->IsObject())
		return ThrowException(Exception::TypeError(String::New("The first parameter must be an object.")));

	args[0]->ToObject()->CreationContext()->Enter();

	return Undefined();
}

Handle<Value> ExitContextOf(const Arguments& args) {
	HandleScope scope;

	if (args.Length() != 1 || !args[0]->IsObject())
		return ThrowException(Exception::TypeError(String::New("The first parameter must be an object.")));

	args[0]->ToObject()->CreationContext()->Exit();

	return Undefined();
}

Handle<Value> GetCurrentContextData(const Arguments& args) {
	return currentCtx;
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
	const char* exception = NULL;
	if (0 == userCodeDepth) {
		pthread_mutex_lock(&mutex);

		// if (-1 != (error = clock_gettime(nodeClockId, &enterTime))) {
		/*if (0 != GetNodeThreadCPUTime(&enterTime))
			exception = "Internal Error. Unable to capture thread CPU time.";
		else */if (1 != args.Length())
			exception = "One parameter required.";
		else if (!args[0]->IsObject())
			exception = "The parameter must be an object (created in user code context).";
		else if (!args[0]->ToObject()->CreationContext()->GetData()->IsString())
			exception = "The specified object's creation context does not have context data set.";
		else {
			// printf("enter user code: %s\n", *String::Utf8Value(args[0]->ToObject()->CreationContext()->GetData()->ToString()));
			currentCtx = Persistent<String>::New(args[0]->ToObject()->CreationContext()->GetData()->ToString());
			inUserCode = true;
			watchdogActive = true;
		}

		pthread_mutex_unlock(&mutex);
	}

	if (exception)
		return ThrowException(Exception::Error(String::New(exception)));
	else {
		userCodeDepth++;
		return Undefined();
	}
}

Handle<Value> LeaveUserCode(const Arguments& args) {
	HandleScope scope;

	if (1 == userCodeDepth) {
		// printf("leave user code\n");
		pthread_mutex_lock(&mutex);
		inUserCode = false;
		currentCtx.Dispose();
		currentCtx.Clear();
		pthread_mutex_unlock(&mutex);
	}

	userCodeDepth--;

	return Undefined();
}

Handle<Value> RunInObjectContext(const Arguments& args) {
	HandleScope scope;

	if (args.Length() != 2 || !args[0]->IsObject() || !args[1]->IsFunction())
		return ThrowException(Exception::TypeError(String::New("The first parameter must be an object and the second a function to run in that object's creation context.")));

	Handle<Object> global = args[0]->ToObject()->CreationContext()->Global();
	Context::Scope contextScope(args[0]->ToObject()->CreationContext());
	Handle<Value> result = Local<Function>::Cast(args[1])->Call(global, 0, NULL);

	return scope.Close(result);
}

Handle<Value> Printf(const Arguments& args) {
	printf("%s\n", *String::Utf8Value(args[0]->ToString()));
	return Undefined();
}

extern "C"
void init(Handle<Object> target) {
	nodeThread = mach_thread_self();
	target->Set(String::NewSymbol("setContextDataOn"), FunctionTemplate::New(SetContextDataOn)->GetFunction());
	target->Set(String::NewSymbol("getCurrentContextData"), FunctionTemplate::New(GetCurrentContextData)->GetFunction());
	target->Set(String::NewSymbol("getContextDataOf"), FunctionTemplate::New(GetContextDataOf)->GetFunction());
	target->Set(String::NewSymbol("startWatchdog"), FunctionTemplate::New(StartWatchdog)->GetFunction());
	target->Set(String::NewSymbol("enterUserCode"), FunctionTemplate::New(EnterUserCode)->GetFunction());
	target->Set(String::NewSymbol("leaveUserCode"), FunctionTemplate::New(LeaveUserCode)->GetFunction());
	target->Set(String::NewSymbol("runInObjectContext"), FunctionTemplate::New(RunInObjectContext)->GetFunction());
	target->Set(String::NewSymbol("printf"), FunctionTemplate::New(Printf)->GetFunction());
}
NODE_MODULE(haiku_extensions, init)
