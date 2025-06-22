// ==UserScript==
// @name         Local SoundCloud Downloader
// @namespace    https://blog.maple3142.net/
// @version      0.1.5
// @description  Download SoundCloud without external service.
// @author       maple3142
// @match        https://soundcloud.com/*
// @require      https://cdn.jsdelivr.net/npm/web-streams-polyfill@2.0.2/dist/ponyfill.min.js
// @require      https://cdn.jsdelivr.net/npm/streamsaver@2.0.3/StreamSaver.min.js
// @grant        none
// @icon         https://a-v2.sndcdn.com/assets/images/sc-icons/favicon-2cadd14bdb.ico
// @downloadURL https://update.greasyfork.org/scripts/394837/Local%20SoundCloud%20Downloader.user.js
// @updateURL https://update.greasyfork.org/scripts/394837/Local%20SoundCloud%20Downloader.meta.js
// ==/UserScript==

streamSaver.mitm = 'https://maple3142.github.io/StreamSaver.js/mitm.html'
function hook(obj, name, callback, type) {
	const fn = obj[name]
	obj[name] = function (...args) {
		if (type === 'before') callback.apply(this, args)
		fn.apply(this, args)
		if (type === 'after') callback.apply(this, args)
	}
	return () => {
		// restore
		obj[name] = fn
	}
}
function triggerDownload(url, name) {
	const a = document.createElement('a')
	document.body.appendChild(a)
	a.href = url
	a.download = name
	a.click()
	a.remove()
}
const btn = {
	init() {
		this.el = document.createElement('button')
		this.el.textContent = 'Download'
		this.el.classList.add('sc-button')
		this.el.classList.add('sc-button-medium')
		this.el.classList.add('sc-button-icon')
		this.el.classList.add('sc-button-responsive')
		this.el.classList.add('sc-button-secondary')
		this.el.classList.add('sc-button-download')
	},
	cb() {
		const par = document.querySelector('.sc-button-toolbar .sc-button-group')
		if (par && this.el.parentElement !== par) par.insertAdjacentElement('beforeend', this.el)
	},
	attach() {
		this.detach()
		this.observer = new MutationObserver(this.cb.bind(this))
		this.observer.observe(document.body, { childList: true, subtree: true })
		this.cb()
	},
	detach() {
		if (this.observer) this.observer.disconnect()
	}
}
btn.init()
async function getClientId() {
	return new Promise(resolve => {
		const restore = hook(
			XMLHttpRequest.prototype,
			'open',
			async (method, url) => {
				const u = new URL(url, document.baseURI)
				const clientId = u.searchParams.get('client_id')
				if (!clientId) return
				console.log('got clientId', clientId)
				restore()
				resolve(clientId)
			},
			'after'
		)
	})
}
const clientIdPromise = getClientId()
let controller = null
async function load(by) {
	btn.detach()
	console.log('load by', by, location.href)
	if (/^(\/(you|stations|discover|stream|upload|search|settings))/.test(location.pathname)) return
	const clientId = await clientIdPromise
	if (controller) {
		controller.abort()
		controller = null
	}
	controller = new AbortController()
	const result = await fetch(
		`https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(location.href)}&client_id=${clientId}`,
		{ signal: controller.signal }
	).then(r => r.json())
	console.log('result', result)
	if (result.kind !== 'track') return
	btn.el.onclick = async () => {
		const progressive = result.media.transcodings.find(t => t.format.protocol === 'progressive')
		if (progressive) {
			const { url } = await fetch(progressive.url + `?client_id=${clientId}`).then(r => r.json())
			const resp = await fetch(url)
			const ws = streamSaver.createWriteStream(result.title + '.mp3', {
				size: resp.headers.get('Content-Length')
			})
			const rs = resp.body
			if (rs.pipeTo) {
				console.log(rs, ws)
				return rs.pipeTo(ws)
			}
			const reader = rs.getReader()
			const writer = ws.getWriter()
			const pump = () =>
				reader.read().then(res => (res.done ? writer.close() : writer.write(res.value).then(pump)))

			return pump()
		}
		alert('Sorry, downloading this music is currently unsupported.')
	}
	btn.attach()
	console.log('attached')
}
load('init')
hook(history, 'pushState', () => load('pushState'), 'after')
window.addEventListener('popstate', () => load('popstate'))
