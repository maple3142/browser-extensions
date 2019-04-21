# Re-enable selecting & copying text

```js
javascript:(()=>{const o=["contextmenu","selectstart","select","mousedown","mouseup","cut","copy"],t=["-webkit","-moz","-ms","-khtml",""],e=window.jQuery;[document,document.body,document.documentElement].forEach(n=>{for(const t of o)n["on"+t]=null,e&&e(n).off(t);if(n.style)for(const o of t){const t=[o,"user-select"].join("-");n.style[t]="initial"}})})();
```

Source:

```js
(() => {
    const events = ['contextmenu', 'selectstart', 'select', 'mousedown', 'mouseup', 'cut', 'copy']
    const prefixes = ['-webkit', '-moz', '-ms', '-khtml', '']
    const $ = window.jQuery
    const remove = el => {
        for (const ev of events) {
            el['on' + ev] = null
            if ($) {
                $(el).off(ev)
            }
        }
        if (el.style) {
            for (const p of prefixes) {
                const prop = [p, 'user-select'].join('-')
                el.style[prop] = 'initial'
            }
        }
    };
    [document, document.body, document.documentElement].forEach(remove)
})()
```

# Redeem steam key

```js
javascript:(()=>{var e=window.getSelection().toString()||prompt("Steam key:");e&&open("https://store.steampowered.com/account/registerkey?key="+e,"_blank")})();
```

# Open in steam

```js
javascript:(()=>{if("steamcommunity.com"==location.hostname||"store.steampowered.com"==location.hostname){var e=document.createElement("a");e.href="steam://openurl/"+location.href,document.body.appendChild(e),e.click(),e.remove()}})();
```

# Unpkg import

```js
javascript:(()=>{var e=prompt("Package name"),t=document.createElement("script");t.src="https://unpkg.com/"+e,document.body.appendChild(t)})();
```
