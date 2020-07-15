// ==UserScript==
// @name         Local YouTube Downloader
// @name:zh-TW   本地 YouTube 下載器
// @name:zh-CN   本地 YouTube 下载器
// @namespace    https://blog.maple3142.net/
// @version      0.9.27
// @description  Get YouTube raw link without external service.
// @description:zh-TW  不需要透過第三方的服務就能下載 YouTube 影片。
// @description:zh-CN  不需要透过第三方的服务就能下载 YouTube 影片。
// @author       maple3142
// @downloadURL  https://github.com/maple3142/browser-extensions/raw/master/scripts/local-youtube-dl.user.js
// @match        https://*.youtube.com/*
// @require      https://unpkg.com/vue@2.6.10/dist/vue.js
// @require      https://unpkg.com/xfetch-js@0.3.4/xfetch.min.js
// @require      https://unpkg.com/@ffmpeg/ffmpeg@0.6.1/dist/ffmpeg.min.js
// @require      https://bundle.run/p-queue@6.3.0
// @grant        GM_xmlhttpRequest
// @connect      googlevideo.com
// @compatible   firefox >=52
// @compatible   chrome >=55
// @license      MIT
// ==/UserScript==

;(function () {
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
			dlmp4: 'Download highest resolution mp4 in one click',
			get_video_failed:
				'You seems to have AdBlocking extension installed, which blocks %s.\nPlease add the following rule to the rule set, or it will prevent Local YouTube Downloader from working.\n\nPS: If it refuse to add that rule, you should uninstall it and use "uBlock Origin" instead.\nIf you still don\'t understand what I am saying, just disable or uninstall all your ad blockers...'
		},
		'zh-tw': {
			togglelinks: '顯示 / 隱藏連結',
			stream: '串流 Stream',
			adaptive: '自適應 Adaptive',
			videoid: '影片 ID: ',
			inbrowser_adaptive_merger:
				'瀏覽器版自適應影片及聲音合成器 (FFmpeg)',
			dlmp4: '一鍵下載高畫質 mp4',
			get_video_failed:
				'您看起來有在使用擋廣告的擴充功能，而它將 %s 給阻擋了。\n請將下方的規則加入你的廣告阻擋器中，否則本地 YouTube 下載器無法正常運作。\n\nPS: 如它拒絕加入該規則，請將它移除並改為使用 "uBlock Origin"。\n如果你仍無法理解我在說什麼，那就直接把全部的廣告阻擋器停用或是移除掉...'
		},
		zh: {
			togglelinks: '显示 / 隐藏链接',
			stream: '串流 Stream',
			adaptive: '自适应 Adaptive',
			videoid: '视频 ID: ',
			inbrowser_adaptive_merger:
				'浏览器版自适应视频及声音合成器 (FFmpeg)',
			dlmp4: '一键下载高画质 mp4',
			get_video_failed:
				'您看起来有在使用挡广告的扩充功能，而它将 %s 给阻挡了。\n请将下方的规则加入你的广告阻挡器中，否则本地 YouTube 下载器无法正常运作。\n\nPS: 如它拒绝加入该规则，请将它移除并改为使用 "uBlock Origin"。\n如果你仍无法理解我在说什么，那就直接把全部的广告阻挡器停用或是移除掉...'
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
			const fnnameresult = /=([a-zA-Z0-9\$]+?)\(decodeURIComponent/.exec(
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
		const data = await xf
			.get(
				`https://www.youtube.com/get_video_info?video_id=${id}&el=detailpage`
			)
			.text()
			.catch(err => null)
		if (!data) return 'Adblock conflict'
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
				Object.assign({}, x, parseQuery(x.cipher || x.signatureCipher))
			)
			logger.log(`video %s stream: %o`, id, stream)
			if (stream[0].sp && stream[0].sp.includes('sig')) {
				for (const obj of stream) {
					obj.s = decsig(obj.s)
					obj.url += `&sig=${obj.s}`
				}
			}
		}

		let adaptive = []
		if (playerResponse.streamingData.adaptiveFormats) {
			adaptive = playerResponse.streamingData.adaptiveFormats.map(x =>
				Object.assign({}, x, parseQuery(x.cipher || x.signatureCipher))
			)
			logger.log(`video %s adaptive: %o`, id, adaptive)
			if (adaptive[0].sp && adaptive[0].sp.includes('sig')) {
				for (const obj of adaptive) {
					obj.s = decsig(obj.s)
					obj.url += `&sig=${obj.s}`
				}
			}
		}
		logger.log(`video %s result: %o`, id, { stream, adaptive })
		return { stream, adaptive, meta: obj }
	}
	const workerMessageHandler = async e => {
		const decsig = await xf.get(e.data.path).text(parseDecsig)
		try {
			const result = await getVideo(e.data.id, decsig)
			self.postMessage(result)
		} catch (e) {
			self.postMessage(e)
		}
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
				if (e.data === 'Adblock conflict') {
					return rej(e.data)
				}
				logger.log('workerGetVideo end: %o', e.data)
				res(e.data)
			}
			ytdlWorker.addEventListener('message', callback)
			ytdlWorker.postMessage({ id, path })
		})
	}

	const determineChunksNum = size => {
		const n = Math.ceil(size / (1024 * 1024 * 3)) // 3 MB
		return n
	}
	// video downloader
	const xhrDownloadUint8Array = async (
		{ url, contentLength },
		progressCb
	) => {
		if (typeof contentLength === 'string')
			contentLength = parseInt(contentLength)
		progressCb({
			loaded: 0,
			total: contentLength,
			speed: 0
		})
		const chunkSize = Math.floor(
			contentLength / determineChunksNum(contentLength)
		)
		const getBuffer = (start, end) =>
			new Promise((res, rej) => {
				const xhr = {}
				xhr.responseType = 'arraybuffer'
				xhr.method = 'GET'
				xhr.url = url
				xhr.headers = {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.124 Safari/537.36',
					Range: `bytes=${start}-${end ? end - 1 : ''}`,
					'Accept-Encoding': 'identity',
					'Accept-Language': 'en-us,en;q=0.5',
					'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.7'
				}
				xhr.onload = obj => res(obj.response)
				GM_xmlhttpRequest(xhr)
			})
		const data = new Uint8Array(contentLength)
		let downloaded = 0
		const queue = new pQueue.default({ concurrency: 5 })
		const startTime = Date.now()
		const ps = []
		for (let start = 0; start < contentLength; start += chunkSize) {
			const exceeded = start + chunkSize > contentLength
			const curChunkSize = exceeded ? contentLength - start : chunkSize
			const end = exceeded ? null : start + chunkSize
			const p = queue.add(() =>
				getBuffer(start, end).then(buf => {
					downloaded += curChunkSize
					data.set(new Uint8Array(buf), start)
					const ds = (Date.now() - startTime + 1) / 1000
					progressCb({
						loaded: downloaded,
						total: contentLength,
						speed: downloaded / ds
					})
				})
			)
			ps.push(p)
		}
		await Promise.all(ps)
		return data
	}

	const ffWorker = FFmpeg.createWorker({
		logger: DEBUG ? m => logger.log(m.message) : () => {}
	})
	let ffWorkerLoaded = false
	const mergeVideo = async (video, audio) => {
		if (!ffWorkerLoaded) await ffWorker.load()
		await ffWorker.write('video.mp4', video)
		await ffWorker.write('audio.mp4', audio)
		await ffWorker.run('-i video.mp4 -i audio.mp4 -c copy output.mp4', {
			input: ['video.mp4', 'audio.mp4'],
			output: 'output.mp4'
		})
		const { data } = await ffWorker.read('output.mp4')
		await ffWorker.remove('output.mp4')
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
			`toolbar=no,height=${screen.height / 2},width=${
				screen.width / 2
			},left=${screenLeft},top=${screenTop}`
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
					const videoObj = adaptive
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
						})[0]
					const audioObj = adaptive.find(x =>
						x.mimeType.includes('audio/mp4')
					)
					const vPromise = xhrDownloadUint8Array(videoObj, e => {
						this.video.progress = (e.loaded / e.total) * 100
						this.video.loaded = (e.loaded / 1024 / 1024).toFixed(2)
						this.video.total = (e.total / 1024 / 1024).toFixed(2)
						this.video.speed = (e.speed / 1024).toFixed(2)
					})
					const aPromise = xhrDownloadUint8Array(audioObj, e => {
						this.audio.progress = (e.loaded / e.total) * 100
						this.audio.loaded = (e.loaded / 1024 / 1024).toFixed(2)
						this.audio.total = (e.total / 1024 / 1024).toFixed(2)
						this.audio.speed = (e.speed / 1024).toFixed(2)
					})
					const [varr, aarr] = await Promise.all([vPromise, aPromise])
					this.merging = true
					win.onunload = () => {
						// trigger download when user close it
						const bvurl = URL.createObjectURL(new Blob([varr]))
						const baurl = URL.createObjectURL(new Blob([aarr]))
						triggerDownload(bvurl, title + '-videoonly.mp4')
						triggerDownload(baurl, title + '-audioonly.mp4')
					}
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
					win.onunload = null
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
			if (err === 'Adblock conflict') {
				const str = app.strings.get_video_failed.replace(
					'%s',
					`https://www.youtube.com/get_video_info?video_id=${id}&el=detailpage`
				)
				prompt(
					str,
					'@@||www.youtube.com/get_video_info?*=detailpage$xhr,domain=youtube.com'
				)
			}
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
