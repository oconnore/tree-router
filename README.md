# Tree-Router for Node.js

[![Build Status](https://secure.travis-ci.org/oconnore/tree-router.png?branch=master)](http://travis-ci.org/oconnore/tree-router)

## What is this?

Tree-Router is a library that handles routing, error handling, and authentication "gates" for your Node.js web application.

It assumes that node is being run with --harmony, to get Map and WeakMap support.

## Usage

### Example
```javascript
    var Server = require('treerouter').Server;

    var server = new Server({
      hostname: '127.0.0.1',
      port: 3000,
    });

    server.addError(Server.AnyMethod, [], function(req, res) {
      res.statusCode = 500;
      res.send('whoops: ' + res.error.message + '\n');
    });

    server.register('GET', ['first', 'page'], function(req, res) {
      res.send('hello world\n');
    });

    server.register('GET', ['first', 'error'], function(req, res) {
      res.error = new Error('something went wrong');
    });

    server.start(function(err) {
      if (err) return;
      console.log('Starting on', this.live.port);
    });
```

results in:

```
    $ curl localhost:3000/first/page
    hello world
    $ curl localhost:3000/first/error
    whoops: something went wrong
    $ curl localhost:3000/second/page
    whoops: Invalid Path
```


### *Server* Object

#### Constructor
- *options*
   - *hostname* ```String``` - the hostname to bind to.
   - *port* ```Integer``` - the port to listen on.
   - *timeouts*
      - *soft* ```Integer``` - defines the read/write timeout of the underlying TCP socket in milliseconds.
      - *hard* ```Integer``` - defines the absolute max lifetime of a connection (<= 0 for infinite life).
   - *logErrors* ```Boolean``` - whether or not we print out error traces with console.error.

#### Instance Methods

User code can call ```start```/```stop``` to create an HTTP server, or can call ```this.setup(server)``` ... ```server.on('request', this.callback.bind(this))``` on an existing server.

- **start**
   - *callback* ```Function``` - a callback called with any errors that occurred starting the server.

- **stop**
   - *callback* ```Function``` - a callback called with any errors that occurred stopping the server.

- **setup**
   - *server* ```HTTPServer``` - the HTTP server to setup (currently establishes timeout handlers).

- **callback** ```Function``` - the callback used to handle requests.

- **register** - Registers a method handler in the tree
   - *method* ```String``` - the HTTP method (or Server.AnyMethod) to respond to.
   - *path* ```Array``` - an array of names, forming a path, to be bound in the tree.
   - *function* ```Function``` - the function responding to HTTPRequest and HTTPResponse.

- **unregister** - Unregisters a method handler from the tree.
   - *method* ```String``` - the HTTP method (or Server.AnyMethod) to respond to.
   - *path* ```Array``` - an array of names, forming a path, to be bound in the tree.
   - *function* ```Function``` - the function responding to HTTPRequest and HTTPResponse.

- **addGate** - Adds an authentication gate. If the gate throws an error, the request cannot continue to traverse the tree.
   - *method* ```String``` - the HTTP method (or Server.AnyMethod) to respond to.
   - *path* ```Array``` - an array of names, forming a path, to be bound in the tree.
   - *function* ```Function``` - the function responding to HTTPRequest and HTTPResponse.

- **removeGate** - Remove a gate from the tree.
   - *method* ```String``` - the HTTP method (or Server.AnyMethod) to respond to.
   - *path* ```Array``` - an array of names, forming a path, to be bound in the tree.
   - *function* ```Function``` - the function responding to HTTPRequest and HTTPResponse.

- **addError** - Adds an error handler to the tree. Any error thrown past this handler in the traversal will bubble back up towards the root, calling error handlers as it goes.
   - *method* ```String``` - the HTTP method (or Server.AnyMethod) to respond to.
   - *path* ```Array``` - an array of names, forming a path, to be bound in the tree.
   - *function* ```Function``` - the function responding to HTTPRequest and HTTPResponse.

- **removeError** - removes an error handler from the tree.
   - *method* ```String``` - the HTTP method (or Server.AnyMethod) to respond to.
   - *path* ```Array``` - an array of names, forming a path, to be bound in the tree.
   - *function* ```Function``` - the function responding to HTTPRequest and HTTPResponse.

### Response Object

The default Node.js response object is extended to include several new methods.

- **bubble** - delegate error handling to the next defined error handler. Should only be called within another error handler.
- **send** - send a string the the client. If the object is composite, ```JSON.stringify()``` is attempted first.

The end.
