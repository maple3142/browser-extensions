// ==UserScript==
// @name         Local YouTube Downloader
// @name:zh-TW   本地 YouTube 下載器
// @name:zh-CN   本地 YouTube 下载器
// @namespace    https://blog.maple3142.net/
// @version      0.5.8
// @description  Get youtube raw link without external service.
// @description:zh-TW  不需要透過第三方的服務就能下載 YouTube 影片。
// @description:zh-CN  不需要透过第三方的服务就能下载 YouTube 影片。
// @author       maple3142
// @match        https://*.youtube.com/*
// @connect      youtube.com
// @require      https://cdnjs.cloudflare.com/ajax/libs/hyperapp/1.2.6/hyperapp.js
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @license      MIT
// ==/UserScript==

;(function() {
	'use strict'
	const DEBUG = false
	const create$p = console =>
		Object.keys(console)
			.map(k => [k, (...args) => (DEBUG ? console[k]('YTDL: ' + args[0], ...args.slice(1)) : void 0)])
			.reduce((acc, [k, fn]) => ((acc[k] = fn), acc), {})
	const $p = create$p(console)

	const LANG_FALLBACK = 'en'
	const LOCALE = {
		en: {
			togglelinks: 'Show/Hide Links',
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
		zh: {
			togglelinks: '显示/隐藏连结',
			stream: '串流 Stream',
			adaptive: '自适应 Adaptive',
			videoid: '影片 Id: {{id}}'
		}
	}
	const findLang = l => {
		// language resolution logic: zh-tw --(if not exists)--> zh --(if not exists)--> LANG_FALLBACK(en)
		l = l.toLowerCase()
		if (l in LOCALE) return l
		else if (l.length > 2) return findLang(l.split('-')[0])
		else return LANG_FALLBACK
	}

	const format = s => d => s.replace(/{{(\w+?)}}/g, (m, g1) => d[g1])
	const $ = (s, x = document) => x.querySelector(s)
	const $el = (tag, opts) => {
		const el = document.createElement(tag)
		Object.assign(el, opts)
		return el
	}
	const gmxhr = (fn => o => new Promise((res, rej) => fn({ ...o, onload: res, onerror: rej })))(
		typeof GM_xmlhttpRequest === 'undefined' ? GM.xmlHttpRequest : GM_xmlhttpRequest
	)
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
		if (typeof ytplayer !== 'undefined' && ytplayer.config) return ytplayer
		$p.log('No ytplayer is founded')
		const html = await gmxhr({
			method: 'GET',
			url: 'https://www.youtube.com' + location.pathname + location.search
		}).then(r => r.responseText)
		const d = /<script >(var ytplayer[\s\S]*?)ytplayer\.load/.exec(html)
		let config = eval(d[1])
		unsafeWindow.ytplayer = {
			config
		}
		$p.log('ytplayer fetched: %o', unsafeWindow.ytplayer)
		return ytplayer
	}
	const parsedecsig = data => {
		const fnname = /\"signature\"\),.+?\.set\(.+?,(.+?)\(/.exec(data)[1]
		const [_, argname, fnbody] = new RegExp(fnname + '=function\\((.+?)\\){(.+?)}').exec(data)
		const helpername = /;(.+?)\..+?\(/.exec(fnbody)[1]
		const helper = new RegExp('var ' + helpername + '={[\\s\\S]+?};').exec(data)[0]
		return new Function([argname], helper + ';' + fnbody)
	}
	const getdecsig = path => xhrhead('https://www.youtube.com' + path).then(parsedecsig)
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
				$p.log(`video ${id} data: %o`, obj)
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
				$p.log(`video ${id} result: %o`, { stream, adaptive })
				return { stream, adaptive }
			})
	}
	const ytdlWorkerCode = `
const DEBUG=${DEBUG}
const $p=(${create$p.toString()})(console)
const parseQuery=${parseQuery.toString()}
const xhrhead=${xhrhead.toString()}
const parsedecsig=${parsedecsig.toString()}
const getdecsig=${getdecsig.toString()}
const getVideo=${getVideo.toString()}
self.onmessage=async e=>{
const decsig=await getdecsig(e.data.path)
const result=await getVideo(e.data.id,decsig)
postMessage(result)
}`
	const ytdlWorker = new Worker(URL.createObjectURL(new Blob([ytdlWorkerCode])))
	const workerGetVideo = (id, path) => {
		$p.log(`workerGetVideo start: ${id} ${path}`)
		return new Promise((res, rej) => {
			const callback = e => {
				ytdlWorker.removeEventListener('message', callback)
				$p.log('workerGetVideo end: %o', e.data)
				res(e.data)
			}
			ytdlWorker.addEventListener('message', callback)
			ytdlWorker.postMessage({ id, path })
		})
	}

	const { app, h } = hyperapp
	const state = {
		hide: true,
		id: '',
		stream: [],
		adaptive: [],
		lang: findLang(navigator.language),
		strings: LOCALE[findLang(navigator.language)]
	}
	$p.log(`default language: ${state.lang}`)
	const actions = {
		toggleHide: () => state => ({ hide: !state.hide }),
		setState: newstate => state => newstate,
		setLang: lang => state => {
			const target = findLang(lang)
			$p.log(`language change to: ${target}`)
			return {
				lang: target,
				strings: LOCALE[target]
			}
		},
		getState: () => state => state
	}
	const view = (state, actions) =>
		h('div', { id: 'ytdl-box' }, [
			h(
				'div',
				{ onclick: () => actions.toggleHide(), id: 'ytdl-box-toggle', className: 't-center' },
				state.strings.togglelinks
			),
			h('div', { className: state.hide ? 'hide' : '' }, [
				h('div', { className: 't-center fs-14px' }, format(state.strings.videoid, state)),
				h('div', { className: 'd-flex' }, [
					h(
						'div',
						{ className: 'f-1 of-h' },
						[h('div', { className: 't-center fs-14px' }, state.strings.stream)].concat(
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
						{ className: 'f-1 of-h' },
						[h('div', { className: 't-center fs-14px' }, state.strings.adaptive)].concat(
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
	if (DEBUG) unsafeWindow.$app = $app
	const load = async id => {
		const ytplayer = await getytplayer()
		return workerGetVideo(id, ytplayer.config.assets.js)
			.then(data => {
				$p.log('video loaded: %s', id)
				$app.setState({
					id,
					stream: data.stream,
					adaptive: data.adaptive
				})
				if (ytplayer.config.args.host_language) $app.setLang(ytplayer.config.args.host_language)
			})
			.catch(err => $p.error('load', err))
	}
	let prevurl = null
	setInterval(() => {
		const el = $('#info-contents') || $('#watch-header') || $('ytm-item-section-renderer>lazy-list')
		if (el && !el.contains(container)) el.appendChild(container)
		if (location.href !== prevurl && location.pathname === '/watch') {
			prevurl = location.href
			$app.setState({
				hide: true
			})
			const id = new URLSearchParams(location.search).get('v')
			$p.log(`start loading new video: ${id}`)
			load(id)
		}
	}, 1000)
	const css = `
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
.of-h{
overflow: hidden;
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
border: 1px solid !important;
border-radius: 3px;
text-decoration: none !important;
outline: 0;
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
`
	document.body.appendChild($el('style', { textContent: css }))
})()
