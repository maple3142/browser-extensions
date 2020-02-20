// ==UserScript==
// @name         i.pximg.net 403 Forbidden Fix
// @namespace    https://blog.maple3142.net/
// @version      0.3
// @description  Fix Pixiv raw image 403
// @author       maple3142
// @match        https://i.pximg.net/*
// @match        https://img-comic.pximg.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @compatible   firefox >=52
// @compatible   chrome >=55
// @license      MIT
// ==/UserScript==

;(function() {
	'use strict'
	const params = new URLSearchParams(location.search)
	const removeAllChild = el => {
		while (el.firstChild) el.removeChild(el.firstChild)
	}
	function download(url, name = true) {
		const a = document.createElement('a')
		a.href = url
		a.download = name
		document.body.appendChild(a)
		a.click()
		a.remove()
	}
	if (document.title === '403 Forbidden') {
		const fname = location.pathname.split('/').slice(-1)[0]

		removeAllChild(document.body)
		document.title = 'Loading image...'
		document.body.style.textAlign = 'center'
		const msg = document.createElement('h1')
		msg.textContent = 'Loading'
		msg.style.padding = '0px'
		msg.style.margin = '0px'
		document.body.appendChild(msg)
		const origlink = document.createElement('a')
		origlink.textContent = 'Original Link'
		origlink.href = `https://www.pixiv.net/member_illust.php?mode=medium&illust_id=${
			/(\d+)/.exec(fname)[1]
		}`
		origlink.target = '_blank'
		origlink.style.display = 'block'
		origlink.style.padding = '0px'
		origlink.style.margin = '0px'
		document.body.appendChild(origlink)
		GM_xmlhttpRequest({
			method: 'GET',
			url: location.href,
			headers: {
				Referer: `https://www.pixiv.net/`
			},
			responseType: 'blob',
			onload: xhr => {
				const blob = xhr.response
				const url = URL.createObjectURL(blob)
				const img = new Image()
				img.src = url
				msg.replaceWith(img)
				img.oncontextmenu = e => {
					e.preventDefault()
					if (confirm('Download Image?')) {
						download(url, fname)
					}
				}
				document.title = fname
			},
			onerror: e => {
				msg.textContent = 'Load failed.'
			}
		})
	}
})()
