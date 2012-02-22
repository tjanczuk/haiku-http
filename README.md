# Multi-tenant runtime for simple HTTP web APIs

Haiku-http provides you with a multi-tenant runtime for hosting simple HTTP web APIs implemented in JavaScript:

- **Sub process multi-tenancy**. You can execute code from multiple tenants within a single process while preserving data integrity of each tenant. You also get a degree of local denial of service prevention: the section about the sandbox below explanins features and limitations.
- **Subset of node.js**. Programming model for authoring HTTP web APIs is based on a subset of node.js. Implementing an HTTP web API resembles coding the body of the node.js HTTP request handler function. You can currently use HTTP[S], TCP, TLS, and MongoDB. 
- **Easy deployment**. You can host the code for HTTP web APIs wherever it can be accessed with an HTTP call from within the runtime. GitHub or Gist work fine. 

## Prerequisites

- Windows, MacOS, or *nix (tested on Windows 7 & 2008 Server, MacOS Lion, Ubuntu 11.10)
- [node.js v0.7.0 or greater](http://nodejs.org/dist/)

## Getting started

Install haiku-http:

```
npm install haiku-http
```

Start the haiku-http runtime (default settings require ports 80 and 443 to be available):

```
sudo node node_modules/haiku-http/src/haiku-http.js
```

Open a browser and navigate to 

```
http://localhost?x-haiku-handler=https://github.com/tjanczuk/haiku-http/blob/master/samples/haikus/hello.js
```

You should see a 'Hello, world!' message, which is the result of executing the haiku-http web API implemented at https://github.com/tjanczuk/haiku-http/blob/master/samples/haikus/hello.js. 