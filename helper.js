/*
 * Helpers for developing userscript.
*/
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const isobj = o => o && typeof o === 'object' && !Array.isArray(o)
const deepmerge = (o, o1) => {
	for (const k of Object.keys(o1)) {
		if (isobj(o1[k])) {
			if (!(k in o)) o[k] = o1[k]
			else deepmerge(o[k], o1[k])
		} else o[k] = o1[k]
	}
	return o
}
const $el = (tag, { props = {}, events = {}, children = [] } = {}) => {
	const el = document.createElement(tag)
	for (const k of Object.keys(props)) {
		if (k in el && isobj(el[k])) deepmerge(el[k], props[k])
		else if (k in el) el[k] = props[k]
		else el.setAttribute(k, props[k])
	}
	for (const k of Object.keys(events)) {
		el.addEventListener(k, events[k])
	}
	for (const c of children) {
		el.appendChild(c)
	}
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
