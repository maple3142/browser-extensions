// ==UserScript==
// @name         Local SoundCloud Downloader
// @namespace    https://blog.maple3142.net/
// @version      0.1.0
// @description  Download SoundCloud without external service.
// @author       maple3142
// @match        https://soundcloud.com/*
// @grant        none
// ==/UserScript==

function hook(obj, name, callback) {
	const fn = obj[name]
	obj[name] = function(...args) {
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
	},
	attach() {
		document
			.querySelector(
				'.listenEngagement__footer .sc-button-toolbar .sc-button-group'
			)
			.insertAdjacentElement('afterbegin', this.el)
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
					const blob = await fetch(url).then(r => r.blob())
					return triggerDownload(
						URL.createObjectURL(blob),
						result.title + '.mp3'
					)
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
