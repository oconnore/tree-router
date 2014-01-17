# Tree-Router for Node.js

[![Build Status](https://secure.travis-ci.org/oconnore/tree-router.png?branch=master)](http://travis-ci.org/oconnore/tree-router)

## What is this?

Tree-Router is a library that handles routing, error handling, and authentication "gates" for your Node.js web application.

The "tree" part is that instead of defining your routes using regular expressions and string matching, tree-router defines a formal tree (a series of hierarchical nodes with children), and then handles routing based on simple rules defined on the tree. This makes reasoning about application routing much easier.

For example, the routes:

```
    [orange, banana, apple]
    [orange, kiwi, strawberry]
    [orange, kiwi, strawberry, mango]
    [blackberry, raspberry]
```

defines a tree that looks like

```
              __ROOT__
             /        \
          orange    blackberry
          /    \         \
       kiwi   banana    raspberry
         |       \
     strawberry  apple
         |
       mango
```

Any partial matches are routed to the closest match, which can either handle the ```request.unused``` path elements, or throw an error. Errors are bubbled up the tree to the nearest error handler in the hierarchy. Authentication and authorization "gates" are triggered while traversing down, allowing application authors to reason about exactly what URL paths are allowed. 

It assumes that node is being run with --harmony, to get Map and WeakMap support.

## Usage

### Example
```javascript
    var Server = require('tree-router').Server;

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

- **addGate** - Adds an authentication gate. If the gate throws an error, the request cannot continue to traverse the tree.
   - *method* ```String``` - the HTTP method (or Server.AnyMethod) to respond to.
   - *path* ```Array``` - an array of names, forming a path, to be bound in the tree.
   - *function* ```Function``` - the function responding to HTTPRequest and HTTPResponse.

- **removeGate** - Remove a gate from the tree.
   - *method* ```String``` - the HTTP method (or Server.AnyMethod) to respond to.
   - *path* ```Array``` - an array of names, forming a path, to be bound in the tree.

- **addError** - Adds an error handler to the tree. Any error thrown past this handler in the traversal will bubble back up towards the root, calling error handlers as it goes.
   - *method* ```String``` - the HTTP method (or Server.AnyMethod) to respond to.
   - *path* ```Array``` - an array of names, forming a path, to be bound in the tree.
   - *function* ```Function``` - the function responding to HTTPRequest and HTTPResponse.

- **removeError** - removes an error handler from the tree.
   - *method* ```String``` - the HTTP method (or Server.AnyMethod) to respond to.
   - *path* ```Array``` - an array of names, forming a path, to be bound in the tree.

### Response Object

The default Node.js response object is extended to include several new methods.

- **bubble** - delegate error handling to the next defined error handler. Should only be called within another error handler.
- **send** - send a string the the client. If the object is composite, ```JSON.stringify()``` is attempted first.

The end.
