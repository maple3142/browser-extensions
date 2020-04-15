// ==UserScript==
// @name         Local SoundCloud Downloader
// @namespace    https://blog.maple3142.net/
// @version      0.1.3
// @description  Download SoundCloud without external service.
// @author       maple3142
// @match        https://soundcloud.com/*
// @require      https://cdn.jsdelivr.net/npm/web-streams-polyfill@2.0.2/dist/ponyfill.min.js
// @require      https://cdn.jsdelivr.net/npm/streamsaver@2.0.3/StreamSaver.min.js
// @grant        none
// @icon         https://a-v2.sndcdn.com/assets/images/sc-icons/favicon-2cadd14bdb.ico
// ==/UserScript==

streamSaver.mitm = 'https://maple3142.github.io/StreamSaver.js/mitm.html'
function hook(obj, name, callback) {
	const fn = obj[name]
	obj[name] = function (...args) {
		callback.apply(this, args)
		fn.apply(this, args)
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
		this.el.classList.add('sc-button-responsive')
		this.el.classList.add('sc-button-download')
	},
	attach() {
		const par = document.querySelector(
			'.listenEngagement__footer .sc-button-toolbar .sc-button-group'
		)
		if (par) par.insertAdjacentElement('beforeend', this.el)
	}
}
btn.init()
function load() {
	if (
		/^(\/(you|stations|discover|stream|upload|search|settings))/.test(
			location.pathname
		)
	)
		return
	const restore = hook(
		XMLHttpRequest.prototype,
		'open',
		async (method, url) => {
			const u = new URL(url, document.baseURI)
			const clientId = u.searchParams.get('client_id')
			if (!clientId) return
			restore()
			const result = await fetch(
				`https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(
					location.href
				)}&client_id=${clientId}`
			).then(r => r.json())
			btn.el.onclick = async () => {
				const progressive = result.media.transcodings.find(
					t => t.format.protocol === 'progressive'
				)
				if (progressive) {
					const { url } = await fetch(
						progressive.url + `?client_id=${clientId}`
					).then(r => r.json())
					const resp = await fetch(url)
					const ws = streamSaver.createWriteStream(
						result.title + '.mp3',
						{
							size: resp.headers.get('Content-Length')
						}
					)
					const rs = resp.body
					if (rs.pipeTo) {
						console.log(rs, ws)
						return rs.pipeTo(ws)
					}
					const reader = rs.getReader()
					const writer = ws.getWriter()
					const pump = () =>
						reader
							.read()
							.then(res =>
								res.done
									? writer.close()
									: writer.write(res.value).then(pump)
							)

					return pump()
				}
				alert('Sorry, downloading this music is currently unsupported.')
			}
			btn.attach()
			console.log('changed')
		}
	)
}
load()
for (const f of ['pushState', 'replaceState', 'forward', 'back', 'go']) {
	hook(history, f, () => load())
}
