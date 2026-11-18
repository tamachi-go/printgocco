PORT ?= 8000
COUNT ?= 15
ZIP_NAME ?= printgocco.zip

.PHONY: sample serve zip

sample:
	python3 scripts/sample.py --count $(COUNT)

serve:
	python3 scripts/sample.py --count $(COUNT) --serve --port $(PORT)

zip:
	rm -f $(ZIP_NAME)
	zip -r $(ZIP_NAME) \
		manifest.json \
		popup.html \
		popup.js \
		print.html \
		print.css \
		print.js \
		assets/
