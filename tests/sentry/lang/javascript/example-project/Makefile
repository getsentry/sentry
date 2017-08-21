all: update

install:
	yarn install

minify: install
	./node_modules/.bin/uglifyjs --mangle --wrap test --source-map test.map --source-map-include-sources --prefix relative --output test.min.js test.js

update: minify
	node triggerError.js

.PHONY: all install minify update
