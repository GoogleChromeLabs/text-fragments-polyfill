# Text Fragments Polyfill

This is an attempt to polyfill the
[Text Fragments](https://wicg.github.io/scroll-to-text-fragment/) feature for
browsers that don't support it directly.

<div align="center">
  <img width="400" src="https://user-images.githubusercontent.com/145676/79250513-02bb5800-7e7f-11ea-8e56-bd63edd31f5b.jpeg">
  <p>
    <sup>
      The text fragment link
      <a href="https://en.wikipedia.org/wiki/Cat#Size:~:text=This%20article%20is,kept%20as%20a%20pet">
        #:~:text=This%20article%20is,kept%20as%20a%20pet
      </a>
      rendered in Safari on an iOS device, with
      <a href="https://github.com/GoogleChromeLabs/text-fragments-polyfill/blob/master/src/text-fragments.js">
        <code>text-fragments.js</code>
      </a>
      injected via Web Inspector.
    </sup>
  </p>
</div>

There are still **many** limitations and the code is very hacky, but it serves
well as a proof of concept. This _could_ be used in Chrome for iOS by injecting
the script with
[`WKUserScript`](https://developer.apple.com/documentation/webkit/wkuserscript).

## Installation

From npm:

```bash
npm install text-fragments-polyfill
```

From unpkg:

```html
<script type="module>
  if (!('fragmentDirective' in Location.prototype)) {
    import('https://unpkg.com/text-fragments-polyfill');
  }
</script>
```

## Usage

```js
// Only load the polyfill in browsers that need it.
if (!('fragmentDirective' in Location.prototype)) {
  import('text-fragments.js');
}
```

## Demo

Try the [demo](https://text-fragments-polyfill.glitch.me/) on a browser that
does not support Text Fragments.

## Development

1. Hack in `/src`.
1. Run `npm run start` and open [http://localhost:8080/demo/](http://localhost:8080/demo/`)
in a browser that does not support Text Fragments URLs directly, for example, Safari.
1. Hack, reload, hack,…
1. You can modify the Text Fragments URLs directly in
[`/demo/index.html`](https://github.com/GoogleChromeLabs/text-fragments-polyfill/blob/master/demo/index.html)
(look for `location.hash`).

## License

Apache 2.0. This is not an official Google product.
