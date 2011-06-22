.PHONY: dist

ver=0.2.1

dist:
	git archive --format=tar --prefix=npm-kjs-$(ver)/ v$(ver) | gzip >npm-kjs-$(ver).tar.gz

