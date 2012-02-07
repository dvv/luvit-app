all:

bootstrap:
	rm -fr tmp
	mkdir -p tmp
	wget -qct3 -O - https://github.com/twitter/bootstrap/tarball/master | tar -xzpf - --strip=1 -C tmp
	cat tmp/js/bootstrap-modal.js tmp/js/bootstrap-alerts.js tmp/js/bootstrap-twipsy.js tmp/js/bootstrap-popover.js tmp/js/bootstrap-dropdown.js tmp/js/bootstrap-scrollspy.js tmp/js/bootstrap-tabs.js tmp/js/bootstrap-buttons.js >example/public/bootstrap.js
	cp tmp/bootstrap.min.css example/public/bootstrap.css
	rm -fr tmp

.PHONY: all bootstrap
.SILENT:
