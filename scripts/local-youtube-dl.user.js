// ==UserScript==
// @name         Local YouTube Downloader
// @name:zh-TW   本地 YouTube 下載器
// @name:zh-CN   本地 YouTube 下载器
// @namespace    https://blog.maple3142.net/
// @version      0.5.1
// @description  Get youtube raw link without external service.
// @description:zh-TW  不需要透過第三方的服務就能下載 YouTube 影片。
// @description:zh-CN  不需要透过第三方的服务就能下载 YouTube 影片。
// @author       maple3142
// @match        https://www.youtube.com/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/hyperapp/1.2.6/hyperapp.js
// @run-at       document-start
// @grant        GM_addStyle
// @license      MIT
// @compatible   firefox >=52
// @compatible   chrome >=55
// ==/UserScript==

;(function() {
	'use strict'
	const LANG_FALLBACK = 'en'
	const LOCALE = {
		en: {
			togglelinks: 'Toggle Links',
			stream: 'Stream',
			adaptive: 'Adaptive',
			videoid: 'Video Id: {{id}}'
		},
		'zh-tw': {
			togglelinks: '顯示/隱藏連結',
			stream: '串流 Stream',
			adaptive: '自適應 Adaptive',
			videoid: '影片 Id: {{id}}'
		},
		'zh-cn': {
			togglelinks: '显示/隐藏连结',
			stream: '串流 Stream',
			adaptive: '自适应 Adaptive',
			videoid: '影片 Id: {{id}}'
		}
	}
	const format = s => d => s.replace(/{{(\w+?)}}/g, (m, g1) => d[g1])
	const $ = (s, x = document) => x.querySelector(s)
	const $el = (tag, opts) => {
		const el = document.createElement(tag)
		Object.assign(el, opts)
		return el
	}
	const xhrhead = url =>
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
		return xhrhead('https://www.youtube.com' + path)
			.then(data => {
				const fnname = /\"signature\"\),.+?\.set\(.+?,(.+?)\(/.exec(data)[1]
				const [_, argname, fnbody] = new RegExp(fnname + '=function\\((.+?)\\){(.+?)}').exec(data)
				//console.log(fnbody)
				const helpername = /;(.+?)\..+?\(/.exec(fnbody)[1]
				//console.log(helpername)
				const helper = new RegExp('var ' + helpername + '={[\\s\\S]+?};').exec(data)[0]
				//console.log(helper)
				const fn = new Function([argname], helper + ';' + fnbody)
				fn.meta = { argname, helper, fnbody }
				return fn
			})
			.then(fn => (unsafeWindow.__YTDL_LINK_DECSIG = fn))
	}
	const parseQuery = s =>
		Object.assign(
			...s
				.split('&')
				.map(x => x.split('='))
				.map(p => ({ [p[0]]: decodeURIComponent(p[1]) }))
		)
	const getVideo = async (id, decsig) => {
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
	const ytdlWorkerCode = `
const parseQuery=${parseQuery.toString()};
const getVideo=${getVideo.toString()};
onmessage=async e=>{
	const {argname,helper,fnbody}=e.data.decsigmeta;
	const decsig=new Function([argname],helper+';'+fnbody);
	const result=await getVideo(e.data.id,decsig);
	postMessage(result)
}`
	const ytdlWorker = new Worker(URL.createObjectURL(new Blob([ytdlWorkerCode])))
	const workerGetVideo = (id, decsigmeta) => {
		return new Promise((res, rej) => {
			const callback = e => {
				ytdlWorker.removeEventListener('message', callback)
				res(e.data)
			}
			ytdlWorker.addEventListener('message', callback)
			ytdlWorker.postMessage({ id, decsigmeta })
		})
	}

	const { app, h } = hyperapp
	const state = {
		hide: true,
		id: '',
		stream: [],
		adaptive: [],
		lang: LOCALE[navigator.language.toLowerCase()] || LOCALE[LANG_FALLBACK]
	}
	const actions = {
		toggleHide: () => state => ({ hide: !state.hide }),
		setState: newstate => state => newstate,
		setLang: lang => state => ({ lang: LOCALE[lang.toLowerCase()] || LOCALE[LANG_FALLBACK] })
	}
	const view = (state, actions) =>
		h('div', { id: 'ytdl-box'}, [
			h(
				'div',
				{ onclick: () => actions.toggleHide(), id: 'ytdl-box-toggle', className: 't-center' },
				state.lang.togglelinks
			),
			h('div', { className: state.hide ? 'hide' : '' }, [
				h('div', { className: 't-center fs-14px' }, format(state.lang.videoid, state)),
				h('div', { className: 'd-flex' }, [
					h(
						'div',
						{ className: 'f-1' },
						[h('div', { className: 't-center fs-14px' }, state.lang.stream)].concat(
							state.stream.map(x =>
								h(
									'a',
									{ href: x.url, title: x.type, target: '_blank', className: 'ytdl-link-btn' },
									x.quality || x.type
								)
							)
						)
					),
					h(
						'div',
						{ className: 'f-1' },
						[h('div', { className: 't-center fs-14px' }, state.lang.adaptive)].concat(
							state.adaptive.map(x =>
								h(
									'a',
									{ href: x.url, title: x.type, target: '_blank', className: 'ytdl-link-btn' },
									(x.quality_label ? x.quality_label + ':' : '') + x.type
								)
							)
						)
					)
				])
			])
		])
	const container = $el('div')
	const $app = app(state, actions, view, container)
	unsafeWindow.$app = $app
	const load = async id => {
		const ytplayer = await getytplayer()
		const decsig = await getdecsig(ytplayer.config.assets.js)
		return workerGetVideo(id, decsig.meta)
			.then(data => {
				console.log('load new: %s', id)
				$app.setState({
					id,
					stream: data.stream,
					adaptive: data.adaptive
				})
			})
			.catch(err => console.error('load', err))
	}
	let prevurl = null
	setInterval(() => {
		const el = $('#info-contents') || $('#watch-header')
		if (el && !el.contains(container)) el.appendChild(container)
		if (location.href !== prevurl && location.pathname === '/watch') {
			prevurl = location.href
			$app.setState({
				hide: true
			})
			load(new URLSearchParams(location.search).get('v'))
		}
	}, 1000)
	GM_addStyle(`
.hide{
display: none;
}
.t-center{
text-align: center;
}
.d-flex{
display: flex;
}
.f-1{
flex: 1;
}
.fs-14px{
font-size: 14px;
}
#ytdl-box{
border-bottom: 1px solid var(--yt-border-color);
}
#ytdl-box-toggle{
margin: 3px;
user-select: none;
-moz-user-select: -moz-none;
}
#ytdl-box-toggle:hover{
color: blue;
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
