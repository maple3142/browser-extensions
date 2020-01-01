// ==UserScript==
// @name         Local YouTube Downloader
// @name:zh-TW   本地 YouTube 下載器
// @name:zh-CN   本地 YouTube 下载器
// @namespace    https://blog.maple3142.net/
// @version      0.9.16
// @description  Get youtube raw link without external service.
// @description:zh-TW  不需要透過第三方的服務就能下載 YouTube 影片。
// @description:zh-CN  不需要透过第三方的服务就能下载 YouTube 影片。
// @author       maple3142
// @match        https://*.youtube.com/*
// @require      https://unpkg.com/vue@2.6.10/dist/vue.js
// @require      https://unpkg.com/xfetch-js@0.3.4/xfetch.min.js
// @require      https://unpkg.com/@ffmpeg/ffmpeg@0.5.2/dist/ffmpeg.min.js
// @grant        GM_xmlhttpRequest
// @connect      googlevideo.com
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
			.map(k => [
				k,
				(...args) =>
					DEBUG
						? console[k](tag + ': ' + args[0], ...args.slice(1))
						: void 0
			])
			.reduce((acc, [k, fn]) => ((acc[k] = fn), acc), {})
	const logger = createLogger(console, 'YTDL')
	const sleep = ms => new Promise(res => setTimeout(res, ms))

	const LANG_FALLBACK = 'en'
	const LOCALE = {
		en: {
			togglelinks: 'Show/Hide Links',
			stream: 'Stream',
			adaptive: 'Adaptive',
			videoid: 'Video Id: ',
			inbrowser_adaptive_merger:
				'In browser adaptive video & audio merger (FFmpeg)',
			dlmp4: 'Download highest resolution mp4 in one click'
		},
		'zh-tw': {
			togglelinks: '顯示 / 隱藏連結',
			stream: '串流 Stream',
			adaptive: '自適應 Adaptive',
			videoid: '影片 ID: ',
			inbrowser_adaptive_merger:
				'瀏覽器版自適應影片及聲音合成器 (FFmpeg)',
			dlmp4: '一鍵下載高畫質 mp4'
		},
		zh: {
			togglelinks: '显示 / 隐藏链接',
			stream: '串流 Stream',
			adaptive: '自适应 Adaptive',
			videoid: '视频 ID: ',
			inbrowser_adaptive_merger:
				'浏览器版自适应视频及声音合成器 (FFmpeg)',
			dlmp4: '一键下载高画质 mp4'
		},
		kr: {
			togglelinks: '링크 보이기/숨기기',
			stream: '스트리밍',
			adaptive: '조정 가능한',
			videoid: 'Video Id: '
		},
		es: {
			togglelinks: 'Mostrar/Ocultar Links',
			stream: 'Stream',
			adaptive: 'Adaptable',
			videoid: 'Id del Video: ',
			inbrowser_adaptive_merger: 'Acoplar Audio a Video (FFmpeg)'
		},
		he: {
			togglelinks: 'הצג/הסתר קישורים',
			stream: 'סטרים',
			adaptive: 'אדפטיבי',
			videoid: 'מזהה סרטון: '
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
	const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const parseDecsig = data => {
		try {
			if (data.startsWith('var script')) {
				// they inject the script via script tag
				const obj = {}
				const document = {
					createElement: () => obj,
					head: { appendChild: () => {} }
				}
				eval(data)
				data = obj.innerHTML
			}
			const fnnameresult = /\.set\([^,]*,encodeURIComponent\(([^(]*)\(/.exec(
				data
			)
			const fnname = fnnameresult[1]
			const _argnamefnbodyresult = new RegExp(
				escapeRegExp(fnname) + '=function\\((.+?)\\){(.+?)}'
			).exec(data)
			const [_, argname, fnbody] = _argnamefnbodyresult
			const helpernameresult = /;(.+?)\..+?\(/.exec(fnbody)
			const helpername = helpernameresult[1]
			const helperresult = new RegExp(
				'var ' + escapeRegExp(helpername) + '={[\\s\\S]+?};'
			).exec(data)
			const helper = helperresult[0]
			logger.log(
				`parsedecsig result: %s=>{%s\n%s}`,
				argname,
				helper,
				fnbody
			)
			return new Function([argname], helper + '\n' + fnbody)
		} catch (e) {
			logger.error('parsedecsig error: %o', e)
			logger.info('script content: %s', data)
			logger.info(
				'If you encounter this error, please copy the full "script content" to https://pastebin.com/ for me.'
			)
		}
	}
	const parseQuery = s =>
		[...new URLSearchParams(s).entries()].reduce(
			(acc, [k, v]) => ((acc[k] = v), acc),
			{}
		)
	const getVideo = async (id, decsig) => {
		return xf
			.get(
				`https://www.youtube.com/get_video_info?video_id=${id}&el=detailpage`
			)
			.text()
			.then(async data => {
				const obj = parseQuery(data)
				const playerResponse = JSON.parse(obj.player_response)
				logger.log(`video %s data: %o`, id, obj)
				logger.log(`video %s playerResponse: %o`, id, playerResponse)
				if (obj.status === 'fail') {
					throw obj
				}
				let stream = []
				if (playerResponse.streamingData.formats) {
					stream = playerResponse.streamingData.formats.map(x =>
						Object.assign(x, parseQuery(x.cipher))
					)
					logger.log(`video %s stream: %o`, id, stream)
					if (stream[0].sp && stream[0].sp.includes('sig')) {
						stream = stream
							.map(x => ({ ...x, s: decsig(x.s) }))
							.map(x => ({ ...x, url: x.url + `&sig=${x.s}` }))
					}
				}

				let adaptive = []
				if (playerResponse.streamingData.adaptiveFormats) {
					adaptive = playerResponse.streamingData.adaptiveFormats.map(
						x => Object.assign(x, parseQuery(x.cipher))
					)
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
					key: 'AIzaSyA_zdfwEy2ULfPCTlwk9DfhBVs2H5qGNU8',
					part: 'snippet',
					id
				}
			})
			.json(r => r.items[0])
	const workerMessageHandler = async e => {
		const decsig = await xf.get(e.data.path).text(parseDecsig)
		const result = await getVideo(e.data.id, decsig)
		self.postMessage(result)
	}
	const ytdlWorkerCode = `
importScripts('https://unpkg.com/xfetch-js@0.3.4/xfetch.min.js')
const DEBUG=${DEBUG}
const logger=(${createLogger})(console, 'YTDL')
const escapeRegExp=${escapeRegExp}
const parseQuery=${parseQuery}
const parseDecsig=${parseDecsig}
const getVideo=${getVideo}
self.onmessage=${workerMessageHandler}`
	const ytdlWorker = new Worker(
		URL.createObjectURL(new Blob([ytdlWorkerCode]))
	)
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

	// video downloader
	const xhrDownloadBuffer = (url, progressCb) => {
		let control, outrej
		const promise = new Promise((res, rej) => {
			if (typeof GM_xmlhttpRequest === 'undefined') {
				return alert(
					"Your userscript manager doesn't support this feature."
				)
			}
			// use gmxhr to bypass CORS problem when coming from home page
			const start = Date.now()
			const xhr = {}
			xhr.responseType = 'arraybuffer'
			xhr.onload = resp => res(resp.response)
			xhr.onerror = rej
			xhr.onprogress = e => {
				if (!e.lengthComputable) return
				const dt = (Date.now() - start) / 1000 // unit: second
				progressCb({
					total: e.total, // bytes
					loaded: e.loaded, // bytes
					speed: e.loaded / dt // bytes/s
				})
			}
			xhr.method = 'GET'
			xhr.url = url

			// abort hack
			control = GM_xmlhttpRequest(xhr)
			outrej = rej
		})
		promise.abort = () => {
			control.abort()
			outrej('aborted')
		}
		return promise
	}

	const ffWorker = FFmpeg.createWorker({
		logger: DEBUG ? m => logger.log(m.message) : () => {}
	})
	let ffWorkerLoaded = false
	const mergeVideo = async (video, audio) => {
		if (!ffWorkerLoaded) await ffWorker.load()
		await ffWorker.write('video.mp4', video)
		await ffWorker.write('audio.mp4', audio)
		await ffWorker.run(
			'-i /data/video.mp4 -i /data/audio.mp4 -c copy output.mp4',
			{
				input: ['video.mp4', 'audio.mp4'],
				output: 'output.mp4'
			}
		)
		const { data } = await ffWorker.read('output.mp4')
		return data
	}
	const triggerDownload = (url, filename) => {
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		document.body.appendChild(a)
		a.click()
		a.remove()
	}
	const dlModalTemplate = `
<div style="width: 100%; height: 100%;">
	<div v-if="merging" style="height: 100%; width: 100%; display: flex; justify-content: center; align-items: center; font-size: 24px;">Merging video, please wait...</div>
	<div v-else style="height: 100%; width: 100%; display: flex; flex-direction: column;">
 		<div style="flex: 1; margin: 10px;">
			<p style="font-size: 24px;">Video</p>
			<progress style="width: 100%;" :value="video.progress" min="0" max="100"></progress>
			<div style="display: flex; justify-content: space-between;">
				<span>{{video.speed}} kB/s</span>
				<span>{{video.loaded}}/{{video.total}} MB</span>
			</div>
		</div>
		<div style="flex: 1; margin: 10px;">
			<p style="font-size: 24px;">Audio</p>
			<progress style="width: 100%;" :value="audio.progress" min="0" max="100"></progress>
			<div style="display: flex; justify-content: space-between;">
				<span>{{audio.speed}} kB/s</span>
				<span>{{audio.loaded}}/{{audio.total}} MB</span>
			</div>
		</div>
	</div>
</div>
`
	function openDownloadModel(adaptive, title) {
		const win = open(
			'',
			'Video Download',
			`toolbar=no,height=${screen.height / 2},width=${screen.width /
				2},left=${screenLeft},top=${screenTop}`
		)
		const div = win.document.createElement('div')
		win.document.body.appendChild(div)
		win.document.title = `Downloading "${title}"`
		const dlModalApp = new Vue({
			template: dlModalTemplate,
			data() {
				return {
					video: {
						progress: 0,
						total: 0,
						loaded: 0,
						speed: 0
					},
					audio: {
						progress: 0,
						total: 0,
						loaded: 0,
						speed: 0
					},
					merging: false
				}
			},
			methods: {
				async start(adaptive, title) {
					win.onbeforeunload = () => true
					// YouTube's default order is descending by video quality
					const vUrl = adaptive
						.filter(x => x.mimeType.includes('video/mp4'))
						.map(v => {
							const [_, quality, fps] = /(\d+)p(\d*)/.exec(
								v.qualityLabel
							)
							v.qualityNum = parseInt(quality)
							v.fps = fps ? parseInt(fps) : 30
							return v
						})
						.sort((a, b) => {
							if (a.qualityNum === b.qualityNum)
								return b.fps - a.fps // ex: 30-60=-30, then a will be put before b
							return b.qualityNum - a.qualityNum
						})[0].url
					const aUrl = adaptive.find(x =>
						x.mimeType.includes('audio/mp4')
					).url
					const vPromise = xhrDownloadBuffer(vUrl, e => {
						this.video.progress = (e.loaded / e.total) * 100
						this.video.loaded = (e.loaded / 1024 / 1024).toFixed(2)
						this.video.total = (e.total / 1024 / 1024).toFixed(2)
						this.video.speed = (e.speed / 1024).toFixed(2)
					})
					const aPromise = xhrDownloadBuffer(aUrl, e => {
						this.audio.progress = (e.loaded / e.total) * 100
						this.audio.loaded = (e.loaded / 1024 / 1024).toFixed(2)
						this.audio.total = (e.total / 1024 / 1024).toFixed(2)
						this.audio.speed = (e.speed / 1024).toFixed(2)
					})
					win.onunload = () => {
						// because GM_xmlhttpRequest won't automatically stop when window closes
						vPromise.abort()
						aPromise.abort()
					}
					const [vbuf, abuf] = await Promise.all([vPromise, aPromise])
					this.merging = true
					const varr = new Uint8Array(vbuf)
					const aarr = new Uint8Array(abuf)
					const result = await Promise.race([
						mergeVideo(varr, aarr),
						sleep(1000 * 25).then(() => null)
					])
					if (!result) {
						alert('An error has occurred when merging video')
						const bvurl = URL.createObjectURL(new Blob([varr]))
						const baurl = URL.createObjectURL(new Blob([aarr]))
						triggerDownload(bvurl, title + '-videoonly.mp4')
						triggerDownload(baurl, title + '-audioonly.mp4')
						return this.close()
					}
					this.merging = false
					const url = URL.createObjectURL(new Blob([result]))
					triggerDownload(url, title + '.mp4')
					win.onbeforeunload = null
					win.close()
				}
			}
		}).$mount(div)
		dlModalApp.start(adaptive, title)
	}

	const template = `
<div class="box" :class="{'dark':dark}">
	<div v-if="adaptive.length" class="of-h t-center c-pointer lh-20">
		<a class="fs-14px" @click="dlmp4" v-text="strings.dlmp4"></a>
	</div>
	<div @click="hide=!hide" class="box-toggle div-a t-center fs-14px c-pointer lh-20" v-text="strings.togglelinks"></div>
	<div :class="{'hide':hide}">
		<div class="t-center fs-14px" v-text="strings.videoid+id"></div>
		<div class="d-flex">
			<div class="f-1 of-h">
				<div class="t-center fs-14px" v-text="strings.stream"></div>
				<a class="ytdl-link-btn fs-14px" target="_blank" v-for="vid in stream" :href="vid.url" :title="vid.type" v-text="vid.quality||vid.type"></a>
			</div>
			<div class="f-1 of-h">
				<div class="t-center fs-14px" v-text="strings.adaptive"></div>
				<a class="ytdl-link-btn fs-14px" target="_blank" v-for="vid in adaptive" :href="vid.url" :title="vid.type" v-text="[vid.qualityLabel,vid.mimeType].filter(x=>x).join(':')"></a>
			</div>
		</div>
		<div class="of-h t-center">
			<a class="fs-14px" href="https://maple3142.github.io/mergemp4/" target="_blank" v-text="strings.inbrowser_adaptive_merger"></a>
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
				meta: null,
				dark: false,
				lang: findLang(navigator.language)
			}
		},
		computed: {
			strings() {
				return LOCALE[this.lang.toLowerCase()]
			}
		},
		methods: {
			dlmp4() {
				const r = JSON.parse(this.meta.player_response)
				openDownloadModel(this.adaptive, r.videoDetails.title)
			}
		},
		template
	})
	logger.log(`default language: %s`, app.lang)

	// attach element
	const shadowHost = $el('div')
	const shadow = shadowHost.attachShadow
		? shadowHost.attachShadow({ mode: 'closed' })
		: shadowHost // no shadow dom
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
		if (typeof ytplayer !== 'undefined' && ytplayer.config) {
			return ytplayer.config.args.host_language
		} else if (typeof yt !== 'undefined') {
			return yt.config_.GAPI_LOCALE
		} else {
			return navigator.language
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
			$('yt-formatted-string.content').innerHTML = textToHtml(
				data.shortDescription
			)
		}
	}
	const load = async id => {
		try {
			const basejs =
				typeof ytplayer !== 'undefined' && ytplayer.config
					? 'https://' + location.host + ytplayer.config.assets.js
					: $('script[src$="base.js"]').src
			const data = await workerGetVideo(id, basejs)
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
			$(
				'.page-container:not([hidden]) ytm-item-section-renderer>lazy-list'
			)
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
a, .div-a{
	text-decoration: none;
	color: var(--yt-button-color, inherit);
}
a:hover, .div-a:hover{
	color: var(--yt-spec-call-to-action, blue);
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
.c-pointer{
	cursor: pointer;
}
.lh-20{
	line-height: 20px;
}
`
	shadow.appendChild($el('style', { textContent: css }))
})()
