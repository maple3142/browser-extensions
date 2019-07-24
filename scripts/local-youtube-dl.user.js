// ==UserScript==
// @name         Local YouTube Downloader
// @name:zh-TW   本地 YouTube 下載器
// @name:zh-CN   本地 YouTube 下载器
// @namespace    https://blog.maple3142.net/
// @version      0.9.2
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
	const RESTORE_ORIGINAL_TITLE_FOR_CURRENT_VIDEO = true
	const createLogger = (console, tag) =>
		Object.keys(console)
			.map(k => [k, (...args) => (DEBUG ? console[k](tag + ': ' + args[0], ...args.slice(1)) : void 0)])
			.reduce((acc, [k, fn]) => ((acc[k] = fn), acc), {})
	const logger = createLogger(console, 'YTDL')

	const LANG_FALLBACK = 'en'
	const LOCALE = {
		en: {
			togglelinks: 'Show/Hide Links',
			stream: 'Stream',
			adaptive: 'Adaptive',
			videoid: 'Video Id: ',
			thumbnail: 'Thumbnail',
			inbrowser_adaptive_merger: 'In browser adaptive video & audio merger'
		},
		'zh-tw': {
			togglelinks: '顯示 / 隱藏連結',
			stream: '串流 Stream',
			adaptive: '自適應 Adaptive',
			videoid: '影片 ID: ',
			thumbnail: '影片縮圖',
			inbrowser_adaptive_merger: '瀏覽器版自適應影片及聲音合成器'
		},
		zh: {
			togglelinks: '显示 / 隐藏链接',
			stream: '串流 Stream',
			adaptive: '自适应 Adaptive',
			videoid: '视频 ID: ',
			thumbnail: '视频缩图',
			inbrowser_adaptive_merger: '浏览器版自适应视频及声音合成器'
		},
		kr: {
			togglelinks: '링크 보이기/숨기기',
			stream: '스트리밍',
			adaptive: '조정 가능한',
			videoid: 'Video Id: {{id}}'
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
	const parseDecsig = data => {
		try {
			if (data.startsWith('var script')) {
				// they inject the script via script tag
				const obj = {}
				const document = { createElement: () => obj, head: { appendChild: () => {} } }
				eval(data)
				data = obj.innerHTML
			}
			const fnnameresult = /\.set\([^,]*,encodeURIComponent\(([^(]*)\(/.exec(data)
			const fnname = fnnameresult[1]
			const _argnamefnbodyresult = new RegExp(fnname + '=function\\((.+?)\\){(.+?)}').exec(data)
			const [_, argname, fnbody] = _argnamefnbodyresult
			const helpernameresult = /;(.+?)\..+?\(/.exec(fnbody)
			const helpername = helpernameresult[1]
			const helperresult = new RegExp('var ' + helpername + '={[\\s\\S]+?};').exec(data)
			const helper = helperresult[0]
			logger.log(`parsedecsig result: %s=>{%s\n%s}`, argname, helper, fnbody)
			return new Function([argname], helper + '\n' + fnbody)
		} catch (e) {
			logger.error('parsedecsig error: %o', e)
			logger.info('script content: %s', data)
			logger.info(
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
				logger.log(`video %s data: %o`, id, obj)
				if (obj.status === 'fail') {
					throw obj
				}
				let stream = []
				if (obj.url_encoded_fmt_stream_map) {
					stream = obj.url_encoded_fmt_stream_map.split(',').map(parseQuery)
					logger.log(`video %s stream: %o`, id, stream)
					if (stream[0].sp && stream[0].sp.includes('sig')) {
						stream = stream
							.map(x => ({ ...x, s: decsig(x.s) }))
							.map(x => ({ ...x, url: x.url + `&sig=${x.s}` }))
					}
				}

				let adaptive = []
				if (obj.adaptive_fmts) {
					adaptive = obj.adaptive_fmts.split(',').map(parseQuery)
					logger.log(`video %s adaptive: %o`, id, adaptive)
					if (adaptive[0].sp && adaptive[0].sp.includes('sig')) {
						adaptive = adaptive
							.map(x => ({ ...x, s: decsig(x.s) }))
							.map(x => ({ ...x, url: x.url + `&sig=${x.s}` }))
					}
				}
				logger.log(`video %s result: %o`, id, { stream, adaptive })
				return { stream, adaptive, meta: obj }
			})
	}
	const getVideoDetails = id =>
		xf
			.get('https://www.googleapis.com/youtube/v3/videos', {
				qs: {
					key: 'AIzaSyBk6o0igFl-P4Qe4ouVlRTPlqX7kruWdUg',
					part: 'snippet',
					id
				}
			})
			.json(r => r.items[0])
	const getHighresThumbnail = id =>
		getVideoDetails(id).then(
			details =>
				Object.values(details.snippet.thumbnails)
					.map(d => {
						const x = {}
						x.url = d.url
						x.size = d.width * d.height
						return x
					})
					.sort((a, b) => b.size - a.size)[0].url
		)
	const workerMessageHandler = async e => {
		const decsig = await xf.get(e.data.path).text(parseDecsig)
		const result = await getVideo(e.data.id, decsig)
		self.postMessage(result)
	}
	const ytdlWorkerCode = `
importScripts('https://unpkg.com/xfetch-js@0.3.4/xfetch.min.js')
const DEBUG=${DEBUG}
const logger=(${createLogger})(console, 'YTDL')
const parseQuery=${parseQuery}
const parseDecsig=${parseDecsig}
const getVideo=${getVideo}
self.onmessage=${workerMessageHandler}`
	const ytdlWorker = new Worker(URL.createObjectURL(new Blob([ytdlWorkerCode])))
	const workerGetVideo = (id, path) => {
		logger.log(`workerGetVideo start: %s %s`, id, path)
		return new Promise((res, rej) => {
			const callback = e => {
				ytdlWorker.removeEventListener('message', callback)
				logger.log('workerGetVideo end: %o', e.data)
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
		<div class="t-center fs-14px">
			<a :href="thumbnail" target="_blank" v-text="strings.thumbnail"></a>
		</div>
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
				thumbnail: null,
				lang: findLang(navigator.language)
			}
		},
		computed: {
			strings() {
				return LOCALE[this.lang.toLowerCase()]
			}
		},
		watch: {
			async hide() {
				if (this.thumbnail == null) {
					app.thumbnail = await getHighresThumbnail(this.id)
				}
			}
		},
		template
	})
	logger.log(`default language: %s`, app.lang)

	// attach element
	const shadowHost = $el('div')
	const shadow = shadowHost.attachShadow ? shadowHost.attachShadow({ mode: 'closed' }) : shadowHost // no shadow dom
	logger.log('shadowHost: %o', shadowHost)
	const container = $el('div')
	shadow.appendChild(container)
	app.$mount(container)

	if (DEBUG && typeof unsafeWindow !== 'undefined') {
		// expose some functions for debugging
		unsafeWindow.$app = app
		unsafeWindow.parseQuery = parseQuery
		unsafeWindow.parseDecsig = parseDecsig
		unsafeWindow.getVideo = getVideo
	}

	const getLangCode = () => {
		if (typeof ytplayer !== 'undefined') {
			return ytplayer.config.args.host_language
		} else if (typeof yt !== 'undefined') {
			return yt.config_.GAPI_LOCALE
		}
		return null
	}
	const textToHtml = t => {
		// URLs starting with http://, https://
		t = t.replace(
			/(\b(https?):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim,
			'<a href="$1" target="_blank">$1</a>'
		)
		t = t.replace(/\n/g, '<br>')
		return t
	}
	const applyOriginalTitle = meta => {
		const data = eval(`(${meta.player_response})`).videoDetails // not a valid json, so JSON.parse won't work
		if ($('#eow-title')) {
			// legacy youtube
			$('#eow-title').textContent = data.title
			$('#eow-description').innerHTML = textToHtml(data.shortDescription)
		} else if ($('h1.title')) {
			// new youtube (polymer)
			$('h1.title').textContent = data.title
			$('yt-formatted-string.content').innerHTML = textToHtml(data.shortDescription)
		}
	}
	const load = async id => {
		const scriptel = $('script[src$="base.js"]')
		try {
			const data = await workerGetVideo(id, scriptel.src)
			logger.log('video loaded: %s', id)
			if (RESTORE_ORIGINAL_TITLE_FOR_CURRENT_VIDEO) {
				try {
					applyOriginalTitle(data.meta)
				} catch (e) {
					// just make sure the main function will work even if original title applier doesn't work
				}
			}
			app.id = id
			app.stream = data.stream
			app.adaptive = data.adaptive
			app.meta = data.meta

			// lazy load thumbnail to save quota, so it will only load thumbnail when expanding
			// app.thumbnail = await getHighresThumbnail(id)
			app.thumbnail = null

			const actLang = getLangCode()
			if (actLang !== null) {
				const lang = findLang(actLang)
				logger.log('youtube ui lang: %s', actLang)
				logger.log('ytdl lang:', lang)
				app.lang = lang
			}
		} catch (err) {
			logger.error('load', err)
		}
	}
	let prev = null
	setInterval(() => {
		const el =
			$('#info-contents') ||
			$('#watch-header') ||
			$('.page-container:not([hidden]) ytm-item-section-renderer>lazy-list')
		if (el && !el.contains(shadowHost)) {
			el.appendChild(shadowHost)
		}
		if (location.href !== prev) {
			logger.log(`page change: ${prev} -> ${location.href}`)
			prev = location.href
			if (location.pathname === '/watch') {
				shadowHost.style.display = 'block'
				const id = parseQuery(location.search).v
				logger.log('start loading new video: %s', id)
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
