all: clean scaffold js css

clean:
	@echo "Cleaning dist folder"
	rm -rf dist

scaffold:
	@echo "Creating dist structure"
	mkdir -p dist/js
	mkdir -p dist/css

js:
	@echo "Bundling Javascript modules"
	yarn rollup -c

css:
	@echo "Bundling styles"
	yarn lessc lib/multi-select.less dist/css/handsontable-multi-select.css
