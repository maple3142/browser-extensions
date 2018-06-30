/*
 * Helpers for developing userscript.
*/
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const elementmerge = (a, b) => {
	Object.keys(b).forEach(k => {
		if (typeof b[k] === 'object') elementmerge(a[k], b[k])
		else if (!a.setAttribute || k in a) a[k] = b[k]
		else a.setAttribute(k, b[k])
	})
}
const $el = (s, o) => {
	const el = document.createElement(s)
	elementmerge(el, o)
	return el
}
const download = (url, fname) => {
	const a = $el('a', { href: url, download: fname || true })
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
}
const gmxhr = o => new Promise((res, rej) => GM_xmlhttpRequest({ ...o, onload: res, onerror: rej }))
const store = new Proxy(
	{},
	{
		get: (t, k) => {
			const value = GM_getValue(k)
			try {
				return JSON.parse(value)
			} catch (e) {
				return value
			}
		},
		set: (t, k, v) => {
			GM_setValue(k, JSON.stringify(v))
			return v
		}
	}
)
