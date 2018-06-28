// ==UserScript==
// @name         Local YouTube Downloader
// @name:zh-TW   本地 YouTube 下載器
// @name:zh-CN   本地 YouTube 下载器
// @namespace    https://blog.maple3142.net/
// @version      0.3.8
// @description  Get youtube raw link without external service.
// @description:zh-TW  不需要透過第三方的服務就能下載 YouTube 影片。
// @description:zh-CN  不需要透过第三方的服务就能下载 YouTube 影片。
// @author       maple3142
// @require      https://code.jquery.com/jquery-3.2.1.slim.min.js
// @match        https://www.youtube.com/*
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

;(function() {
	'use strict'
	const xhrget = url =>
		new Promise((res, rej) => {
			const xhr = new XMLHttpRequest()
			xhr.open('HEAD', url)
			xhr.onreadystatechange = () => {
				if (xhr.readyState === xhr.DONE) {
					res(xhr.responseText)
				}
			}
			xhr.onerror = rej
			xhr.send()
		})
	// type "__YTDL_LINK_DECSIG.toString().split('\n').join('')" in console to get fallback
	const fallback = function anonymous(a) {
		var gL = {
			pk: function(a) {
				a.reverse()
			},
			k9: function(a, b) {
				a.splice(0, b)
			},
			TA: function(a, b) {
				var c = a[0]
				a[0] = a[b % a.length]
				a[b % a.length] = c
			}
		}
		a = a.split('')
		gL.k9(a, 3)
		gL.TA(a, 44)
		gL.k9(a, 2)
		gL.TA(a, 34)
		return a.join('')
	}
	const getytplayer = async () => {
		if (ytplayer && ytplayer.config) return ytplayer
		const html = await fetch(location.href).then(r => r.text())
		const d = /<script >(var ytplayer[\s\S]*?)ytplayer\.load/.exec(html)
		let config = eval(d[1])
		unsafeWindow.ytplayer = {
			config
		}
		return ytplayer
	}
	const getdecsig = async path => {
		return xhrget('https://www.youtube.com' + path)
			.then(data => {
				const fnname = /\"signature\"\),.+?\.set\(.+?,(.+?)\(/.exec(data)[1]
				const [_, argname, fnbody] = new RegExp(fnname + '=function\\((.+?)\\){(.+?)}').exec(data)
				//console.log(fnbody)
				const helpername = /;(.+?)\..+?\(/.exec(fnbody)[1]
				//console.log(helpername)
				const helper = new RegExp('var ' + helpername + '={[\\s\\S]+?};').exec(data)[0]
				//console.log(helper)
				return new Function([argname], helper + ';' + fnbody)
			})
			.catch(e => fallback)
			.then(fn => (unsafeWindow.__YTDL_LINK_DECSIG = fn))
	}
	const parseQuery = s =>
		Object.assign(
			...s
				.split('&')
				.map(x => x.split('='))
				.map(p => ({ [p[0]]: decodeURIComponent(p[1]) }))
		)
	const getVideo = async id => {
		const ytplayer = await getytplayer()
		const decsig = await getdecsig(ytplayer.config.assets.js)
		return fetch(`https://www.youtube.com/get_video_info?video_id=${id}&el=detailpage`)
			.then(r => r.text())
			.then(async data => {
				const obj = parseQuery(data)
				if (obj.status === 'fail') {
					throw obj
				}
				let stream = []
				if (obj.url_encoded_fmt_stream_map) {
					stream = obj.url_encoded_fmt_stream_map.split(',').map(parseQuery)
					if (stream[0].sp && stream[0].sp.includes('signature')) {
						stream = stream
							.map(x => ({ ...x, s: decsig(x.s) }))
							.map(x => ({ ...x, url: x.url + `&signature=${x.s}` }))
					}
				}

				let adaptive = []
				if (obj.adaptive_fmts) {
					adaptive = obj.adaptive_fmts.split(',').map(parseQuery)
					if (adaptive[0].sp && adaptive[0].sp.includes('signature')) {
						adaptive = adaptive
							.map(x => ({ ...x, s: decsig(x.s) }))
							.map(x => ({ ...x, url: x.url + `&signature=${x.s}` }))
					}
				}
				return { stream, adaptive }
			})
	}
	const $box = $('<div>')
		.attr('id', 'ytdl-box')
		.css('z-index', '10000')
	const boxel = $box.get(0)
	const $toggle = $('<div>')
		.attr('id', 'ytdl-box-toggle')
		.css('text-align', 'center')
		.text('Toggle Links')
	const $content = $('<div>')
		.attr('id', 'ytdl-content')
		.css('height', 0)
	const $id = $('<div>')
	const $bbox = $('<div>').css('display', 'flex')
	const $stream = $('<div>').css('flex', 1)
	const $adaptive = $('<div>').css('flex', 1)
	let hide = true
	$box.append($toggle).append($content)
	$toggle.on('click', e => {
		if (hide) $content.css('height', $content[0].scrollHeight)
		else $content.css('height', 0)
		hide = !hide
	})
	$content.append($id).append($bbox.append($stream).append($adaptive))
	const load = id =>
		getVideo(id)
			.then(data => {
				console.log('load new: %s', id)
				$id.empty().append(
					$('<div>')
						.addClass('ytdl-link-title')
						.text(id)
				)
				$stream.empty().append(
					$('<div>')
						.addClass('ytdl-link-title')
						.text('Stream')
				)
				data.stream
					.map(x =>
						$('<a>')
							.text(x.quality || x.type)
							.attr('href', x.url)
							.attr('title', x.type)
							.attr('target', '_blank')
							.addClass('ytdl-link-btn')
					)
					.forEach($li => $stream.append($li))
				$adaptive.empty().append(
					$('<div>')
						.addClass('ytdl-link-title')
						.text('Adaptive')
				)
				data.adaptive
					.map(x =>
						$('<a>')
							.text((x.quality_label ? x.quality_label + ':' : '') + x.type)
							.attr('href', x.url)
							.attr('title', x.type)
							.attr('target', '_blank')
							.addClass('ytdl-link-btn')
					)
					.forEach($li => $adaptive.append($li))
			})
			.catch(err => console.error('load', err))
	let prevurl = null
	setInterval(() => {
		const el = document.querySelector('#info-contents')
		if (el && !el.contains(boxel)) el.appendChild(boxel)
		if (location.href !== prevurl && location.pathname === '/watch') {
			prevurl = location.href
			const q = parseQuery(location.search.slice(1))
			load(q.v)
		}
	}, 1000)
	GM_addStyle(`
#ytdl-box-toggle{
margin: 3px;
user-select: none;
-moz-user-select: -moz-none;
}
#ytdl-box-toggle:hover{
color: blue;
}
#ytdl-content{
overflow: hidden;
transition: ease 1s;
}
.ytdl-link-title{
text-align: center;
font-size: 140%;
margin: 1px;
}
.ytdl-link-btn{
display: block;
border: 1px solid;
border-radius: 3px;
text-align: center;
padding: 2px;
margin: 5px;
color: black;
}
a.ytdl-link-btn{
text-decoration: none;
}
a.ytdl-link-btn:hover{
color: blue;
}
`)
})()
