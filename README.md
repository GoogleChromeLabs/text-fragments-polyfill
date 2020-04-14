# Text Fragments Polyfill

This is an attempt to polyfill the [Text Fragments](https://wicg.github.io/ScrollToTextFragment/) feature
for browsers that don't support it natively.

![08448620-B60D-43E8-8887-2D8593CC9486](https://user-images.githubusercontent.com/145676/79250513-02bb5800-7e7f-11ea-8e56-bd63edd31f5b.jpeg)

The photo above shows the text fragment link
[en.wikipedia.org/wiki/Cat#Size:~:text=This%20article%20is,kept%20as%20a%20pet](https://en.wikipedia.org/wiki/Cat#Size:~:text=This%20article%20is,kept%20as%20a%20pet)
rendered in Safari on an iOS device running Safari, with
[`inject.js`](https://github.com/tomayac/text-fragments-polyfill/blob/master/inject.js)
injected via Web Inspector.
There are still many limitations and the code is very hacky, but it serves well as a proof of concept.
This *could* be used in Chrome for iOS by injecting the script with
[`WKUserScript`](https://developer.apple.com/documentation/webkit/wkuserscript).
