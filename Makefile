.PHONY: clean test examples examples/hello examples/auth

install:
	npm install

test:
	node --harmony test/setup.js

examples:
	find examples/ -name 'package.json' -a ! -path '*/node_modules/*' -execdir npm install \;

examples/hello:
	node --harmony examples/hello/index.js

examples/auth:
	node --harmony examples/auth/index.js

clean:
	rm -rf node_modules
