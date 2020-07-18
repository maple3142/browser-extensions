// ==UserScript==
// @name              khinsider batch downloader
// @name:zh-TW        khinsider 批量下載器
// @namespace         https://blog.maple3142.net/
// @description       batch download for downloads.khinsider.com originalsoundtracks
// @description:zh-TW 批量下載 downloads.khinsider.com 的原聲帶
// @version           0.2.1
// @author            maple3142
// @match             https://downloads.khinsider.com/game-soundtracks/album/*
// @require           https://cdn.jsdelivr.net/npm/web-streams-polyfill@2.0.2/dist/ponyfill.min.js
// @require           https://cdn.jsdelivr.net/npm/streamsaver@2.0.3/StreamSaver.min.js
// @require           https://cdn.jsdelivr.net/gh/maple3142/StreamSaver.js/examples/zip-stream.min.js
// @license           MIT
// @connect           vgmdownloads.com
// @grant             GM_xmlhttpRequest
// ==/UserScript==

streamSaver.mitm = 'https://maple3142.github.io/StreamSaver.js/mitm.html'

function download(url) {
	return new Promise((resolve, reject) => {
		GM_xmlhttpRequest({
			method: 'GET',
			url,
			responseType: 'blob',
			onload: res => resolve(res.response)
		})
	})
}

let started = false
$('a:contains("click to download")').on('click', async e => {
	e.preventDefault()
	$(e.target).text("Don't close this tab until download complete.")
	if (started) return
	started = true
	const title = $('h2')[0].textContent
	const files = $('tr>td.clickable-row:not([align])')
		.toArray()
		.map(el => $(el).find('a').attr('href'))
		.map(url => {
			const obj = {}
			obj.pageUrl = url
			obj.blobPromise = fetch(url)
				.then(r => r.text())
				.then(html => {
					obj.url = $(html)
						.find('a:contains("Click here to download as MP3")')
						.attr('href')
					obj.name = decodeURIComponent(obj.url.split('/').pop())
					return download(obj.url)
				})
			return obj
		})
	const ws = streamSaver.createWriteStream(title + '.zip')
	new ZIP({
		async pull(ctrl) {
			const f = files.shift()
			const stream = new Response(await f.blobPromise).body
			ctrl.enqueue({ name: f.name, stream: () => stream })
			if (files.length === 0) ctrl.close()
		}
	})
		.pipeTo(ws)
		.then(console.log, console.error)
})
