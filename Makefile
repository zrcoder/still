.PHONY: dev build clean

xgo:
	xgo mod tidy
	xgo go

dev: xgo
	wails dev

build: xgo
	wails build

clean:
	xgo clean
