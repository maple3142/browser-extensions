// ==UserScript==
// @name         Local YouTube Downloader
// @name:zh-TW   本地 YouTube 下載器
// @name:zh-CN   本地 YouTube 下载器
// @namespace    https://blog.maple3142.net/
// @version      0.8.0
// @description  Get youtube raw link without external service.
// @description:zh-TW  不需要透過第三方的服務就能下載 YouTube 影片。
// @description:zh-CN  不需要透过第三方的服务就能下载 YouTube 影片。
// @author       maple3142
// @match        https://*.youtube.com/*
// @require      https://unpkg.com/vue@2.6.10/dist/vue.js
// @require      https://unpkg.com/xfetch-js@0.3.4/xfetch.min.js
// @compatible   firefox >=52
// @compatible   chrome >=55
// @license      MIT
// ==/UserScript==

;(function() {
	'use strict'
	const DEBUG = true
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
			videoid: 'Video Id: ',
			inbrowser_adaptive_merger: 'In browser adaptive video & audio merger'
		},
		'zh-tw': {
			togglelinks: '顯示 / 隱藏連結',
			stream: '串流 Stream',
			adaptive: '自適應 Adaptive',
			videoid: '影片 ID: ',
			inbrowser_adaptive_merger: '瀏覽器版自適應影片及聲音合成器'
		},
		zh: {
			togglelinks: '显示 / 隐藏链接',
			stream: '串流 Stream',
			adaptive: '自适应 Adaptive',
			videoid: '视频 ID: ',
			inbrowser_adaptive_merger: '浏览器版自适应视频及声音合成器'
		}
	}
	const findLang = l => {
		// language resolution logic: zh-tw --(if not exists)--> zh --(if not exists)--> LANG_FALLBACK(en)
		l = l.toLowerCase().replace('_', '-')
		if (l in LOCALE) return l
		else if (l.length > 2) return findLang(l.split('-')[0])
		else return LANG_FALLBACK
	}
	const $ = (s, x = document) => x.querySelector(s)
	const $el = (tag, opts) => {
		const el = document.createElement(tag)
		Object.assign(el, opts)
		return el
	}
	const xhrget = url =>
		// not sure why `fetch` doesn't work here
		new Promise((res, rej) => {
			const xhr = new XMLHttpRequest()
			xhr.open('GET', url)
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
		const html = await xf.get(location.href).text()
		const d = /<script >(var ytplayer[\s\S]*?)ytplayer\.load/.exec(html)
		let config = eval(d[1])
		unsafeWindow.ytplayer = {
			config
		}
		$p.log('ytplayer fetched: %o', unsafeWindow.ytplayer)
		return ytplayer
	}
	const parsedecsig = data => {
		try {
			if (data.startsWith('var script')) {
				// they inject the script via script tag
				const obj = {}
				const document = { createElement: () => obj, head: { appendChild: () => {} } }
				eval(data)
				data = obj.innerHTML
			}
			const fnnameresult = /yt\.akamaized\.net.*encodeURIComponent\((\w+)/.exec(data)
			const fnname = fnnameresult[1]
			const _argnamefnbodyresult = new RegExp(fnname + '=function\\((.+?)\\){(.+?)}').exec(data)
			const [_, argname, fnbody] = _argnamefnbodyresult
			const helpernameresult = /;(.+?)\..+?\(/.exec(fnbody)
			const helpername = helpernameresult[1]
			const helperresult = new RegExp('var ' + helpername + '={[\\s\\S]+?};').exec(data)
			const helper = helperresult[0]
			$p.log(`parsedecsig result: %s=>{%s\n%s}`, argname, helper, fnbody)
			return new Function([argname], helper + '\n' + fnbody)
		} catch (e) {
			$p.error('parsedecsig error: %o', e)
			$p.info('script content: %s', data)
			$p.info(
				'If you encounter this error, please copy the full "script content" to https://pastebin.com/ for me.'
			)
		}
	}
	const parseQuery = s => [...new URLSearchParams(s).entries()].reduce((acc, [k, v]) => ((acc[k] = v), acc), {})
	const getVideo = async (id, decsig) => {
		return xf
			.get(`https://www.youtube.com/get_video_info?video_id=${id}&el=detailpage`)
			.text()
			.then(async data => {
				const obj = parseQuery(data)
				$p.log(`video %s data: %o`, id, obj)
				if (obj.status === 'fail') {
					throw obj
				}
				let stream = []
				if (obj.url_encoded_fmt_stream_map) {
					stream = obj.url_encoded_fmt_stream_map.split(',').map(parseQuery)
					$p.log(`video %s stream: %o`, id, stream)
					if (stream[0].sp && stream[0].sp.includes('signature')) {
						stream = stream
							.map(x => ({ ...x, s: decsig(x.s) }))
							.map(x => ({ ...x, url: x.url + `&signature=${x.s}` }))
					}
				}

				let adaptive = []
				if (obj.adaptive_fmts) {
					adaptive = obj.adaptive_fmts.split(',').map(parseQuery)
					$p.log(`video %s adaptive: %o`, id, adaptive)
					if (adaptive[0].sp && adaptive[0].sp.includes('signature')) {
						adaptive = adaptive
							.map(x => ({ ...x, s: decsig(x.s) }))
							.map(x => ({ ...x, url: x.url + `&signature=${x.s}` }))
					}
				}
				$p.log(`video %s result: %o`, id, { stream, adaptive })
				return { stream, adaptive, meta: obj }
			})
	}
	const workerMessageHandler = async e => {
		const decsig = await xf.get(e.data.path).text(parsedecsig)
		const result = await getVideo(e.data.id, decsig)
		self.postMessage(result)
	}
	const ytdlWorkerCode = `
importScripts('https://unpkg.com/xfetch-js@0.3.4/xfetch.min.js')
const DEBUG=${DEBUG}
const $p=(${create$p.toString()})(console)
const parseQuery=${parseQuery.toString()}
const xhrget=${xhrget.toString()}
const parsedecsig=${parsedecsig.toString()}
const getVideo=${getVideo.toString()}
self.onmessage=${workerMessageHandler.toString()}`
	const ytdlWorker = new Worker(URL.createObjectURL(new Blob([ytdlWorkerCode])))
	const workerGetVideo = (id, path) => {
		$p.log(`workerGetVideo start: %s %s`, id, path)
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

	const template = `
<div class="box" :class="{'dark':dark}">
	<div @click="hide=!hide" class="box-toggle t-center fs-14px" v-text="strings.togglelinks"></div>
	<div :class="{'hide':hide}">
		<div class="t-center fs-14px" v-text="strings.videoid+id"></div>
		<div class="d-flex">
			<div class="f-1 of-h">
				<div class="t-center fs-14px" v-text="strings.stream"></div>
				<a class="ytdl-link-btn fs-14px" target="_blank" v-for="vid in stream" :href="vid.url" :title="vid.type" v-text="vid.quality||vid.type"></a>
			</div>
			<div class="f-1 of-h">
				<div class="t-center fs-14px" v-text="strings.adaptive"></div>
				<a class="ytdl-link-btn fs-14px" target="_blank" v-for="vid in adaptive" :href="vid.url" :title="vid.type" v-text="[vid.quality_label,vid.type].filter(x=>x).join(':')"></a>
			</div>
		</div>
		<div class="of-h t-center">
			<a href="https://maple3142.github.io/mergemp4/" target="_blank" v-text="strings.inbrowser_adaptive_merger"></a>
		</div>
	</div>
</div>
`.slice(1)
	const app = new Vue({
		data() {
			return {
				hide: true,
				id: '',
				stream: [],
				adaptive: [],
				dark: false,
				lang: findLang(navigator.language)
			}
		},
		computed: {
			strings() {
				return LOCALE[this.lang.toLowerCase()]
			}
		},
		template
	})
	$p.log(`default language: %s`, app.lang)

	// attach element
	const shadowHost = $el('div')
	const shadow = shadowHost.attachShadow ? shadowHost.attachShadow({ mode: 'closed' }) : shadowHost // no shadow dom
	$p.log('shadowHost: %o', shadowHost)
	const container = $el('div')
	shadow.appendChild(container)
	app.$mount(container)

	if (DEBUG) unsafeWindow.$app = app
	const getLangCode = () => {
		if (typeof ytplayer !== 'undefined') {
			return ytplayer.config.args.host_language
		} else if (typeof yt !== 'undefined') {
			return yt.config_.GAPI_LOCALE
		}
		return null
	}
	const load = async id => {
		const scriptel = $('script[src$="base.js"]')
		return workerGetVideo(id, scriptel.src)
			.then(async data => {
				$p.log('video loaded: %s', id)
				app.id = id
				app.stream = data.stream
				app.adaptive = data.adaptive
				app.meta = data.meta
				const actLang = getLangCode()
				if (actLang !== null) {
					const lang = findLang(actLang)
					$p.log('youtube ui lang: %s', actLang)
					$p.log('ytdl lang:', lang)
					app.lang = lang
				}
			})
			.catch(err => $p.error('load', err))
	}
	let prevpath = null
	setInterval(() => {
		const el =
			$('#info-contents') ||
			$('#watch-header') ||
			$('.page-container:not([hidden]) ytm-item-section-renderer>lazy-list')
		if (el && !el.contains(shadowHost)) {
			el.appendChild(shadowHost)
		}
		if (location.pathname !== prevpath) {
			$p.log(`page change: ${prevpath} -> ${location.pathname}`)
			prevpath = location.pathname
			if (location.pathname === '/watch') {
				shadowHost.style.display = 'block'
				const id = parseQuery(location.search).v
				$p.log('start loading new video: %s', id)
				app.hide = true // fold it
				load(id)
			} else {
				shadowHost.style.display = 'none'
			}
		}
	}, 1000)

	// listen to dark mode toggle
	const $html = $('html')
	new MutationObserver(() => {
		app.dark = $html.getAttribute('dark') === 'true'
	}).observe($html, { attributes: true })
	app.dark = $html.getAttribute('dark') === 'true'

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
.box{
border-bottom: 1px solid var(--yt-border-color);
font-family: Arial;
}
.box-toggle{
margin: 3px;
user-select: none;
-moz-user-select: -moz-none;
}
.box-toggle:hover{
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
.box.dark{
color: var(--ytd-video-primary-info-renderer-title-color, var(--yt-primary-text-color));
}
.box.dark .ytdl-link-btn{
color: var(--ytd-video-primary-info-renderer-title-color, var(--yt-primary-text-color));
}
.box.dark .ytdl-link-btn:hover{
color: rgba(200, 200, 255, 0.8);
}
.box.dark .box-toggle:hover{
color: rgba(200, 200, 255, 0.8);
}
`
	shadow.appendChild($el('style', { textContent: css }))
})()
