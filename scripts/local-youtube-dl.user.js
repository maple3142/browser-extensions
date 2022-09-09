// ==UserScript==
// @name         Local YouTube Downloader
// @name:zh-TW   本地 YouTube 下載器
// @name:zh-HK   本地 YouTube 下載器
// @name:zh-CN   本地 YouTube 下载器
// @name:ja      ローカル YouTube ダウンローダー
// @name:kr      로컬 YouTube 다운로더
// @namespace    https://blog.maple3142.net/
// @version      0.9.50
// @description        Download YouTube videos without external service.
// @description:zh-TW  不需透過第三方服務即可下載 YouTube 影片。
// @description:zh-HK  不需透過第三方服務即可下載 YouTube 影片。
// @description:zh-CN  不需要透过第三方的服务就能下载 YouTube 视频。
// @description:ja     外部サービスなしで YouTube 動画をダウンロード
// @description:kr     외부 서비스없이 YouTube 동영상을 다운로드
// @description:fr     Obtenez un lien brut YouTube sans service externe.
// @description:cs     Stahujte YouTube videa bez externích služeb.
// @author       maple3142
// @match        https://*.youtube.com/*
// @require      https://unpkg.com/vue@2.6.10/dist/vue.js
// @require      https://unpkg.com/xfetch-js@0.3.4/xfetch.min.js
// @require      https://unpkg.com/@ffmpeg/ffmpeg@0.6.1/dist/ffmpeg.min.js
// @require      https://bundle.run/p-queue@6.3.0
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-end
// @connect      googlevideo.com
// @compatible   firefox >=52
// @compatible   chrome >=55
// @license      MIT
// ==/UserScript==

;(function () {
	'use strict'
	const DEBUG = true
	const createLogger = (console, tag) =>
		Object.keys(console)
			.map(k => [k, (...args) => (DEBUG ? console[k](tag + ': ' + args[0], ...args.slice(1)) : void 0)])
			.reduce((acc, [k, fn]) => ((acc[k] = fn), acc), {})
	const logger = createLogger(console, 'YTDL')
	const sleep = ms => new Promise(res => setTimeout(res, ms))

	const LANG_FALLBACK = 'en'
	const LOCALE = {
		en: {
			togglelinks: 'Show/Hide Links',
			stream: 'Stream',
			adaptive: 'Adaptive (No Sound)',
			videoid: 'Video ID: ',
			inbrowser_adaptive_merger: 'Online Adaptive Video & Audio Merger (FFmpeg)',
			dlmp4: 'Download high-resolution mp4 in one click',
			get_video_failed: 'Failed to get video infomation for unknown reason, refresh the page may work.',
			live_stream_disabled_message: 'Local YouTube Downloader is not available for live stream'
		},
		'zh-tw': {
			togglelinks: '顯示 / 隱藏連結',
			stream: '串流 Stream',
			adaptive: '自適應 Adaptive (沒有聲音)',
			videoid: '影片 ID: ',
			inbrowser_adaptive_merger: '線上自適應影片及音訊合成工具 (FFmpeg)',
			dlmp4: '一鍵下載高畫質 mp4',
			get_video_failed: '無法取得影片資訊，重新整理頁面可能會有效果。',
			live_stream_disabled_message: '因為是直播的緣故，本地 YouTube 下載器的功能是停用的。'
		},
		'zh-hk': {
			togglelinks: '顯示／隱藏連結',
			stream: '串流 Stream',
			adaptive: '自動適應 Adaptive (沒有聲音)',
			videoid: '影片 ID: ',
			inbrowser_adaptive_merger: '網上自動適應影片及音訊合成工具 (FFmpeg)',
			dlmp4: '一 click 下載高畫質 mp4',
			get_video_failed: '無法取得影片資訊，重新整理頁面可能會有效果。',
			live_stream_disabled_message: '本地 YouTube 下載器無法用於直播。'
		},
		zh: {
			togglelinks: '显示／隐藏链接',
			stream: '串流 Stream',
			adaptive: '自适应 Adaptive (没有声音)',
			videoid: '视频 ID: ',
			inbrowser_adaptive_merger: '线上自适应视频及音频合成工具 (FFmpeg)',
			dlmp4: '一键下载高画质 mp4',
			get_video_failed: '无法取得影片资讯，重新整理页面可能会有效果。',
			live_stream_disabled_message: '因为是直播，本地 YouTube 下载器的功能已被禁用。'
		},
		ja: {
			togglelinks: 'リンク表示・非表示',
			stream: 'ストリーミング',
			adaptive: 'アダプティブ（音無し）',
			videoid: 'ビデオ ID: ',
			inbrowser_adaptive_merger: 'ビデオとオーディオを合併するオンラインツール (FFmpeg)',
			dlmp4: 'ワンクリックで高解像度の mp4 をダウンロード',
			live_stream_disabled_message: 'ライブ配信のため、ローカル YouTube ダウンローダーは無効になっています。'
		},
		kr: {
			togglelinks: '링크 보이기 · 숨기기',
			stream: '스트리밍',
			adaptive: '적응 (어댑티브)',
			videoid: '비디오 ID: ',
			inbrowser_adaptive_merger: '비디오와 오디오를 합병하는 온라인 도구 (FFmpeg)',
			dlmp4: '한 번의 클릭으로 고해상도 mp4 다운로드'
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
		},
		fr: {
			togglelinks: 'Afficher/Masquer les liens',
			stream: 'Stream',
			adaptive: 'Adaptative',
			videoid: 'ID vidéo: ',
			inbrowser_adaptive_merger: 'Fusionner vidéos et audios adaptatifs dans le navigateur (FFmpeg)',
			dlmp4: 'Téléchargez la plus haute résolution mp4 en un clic'
		},
		pl: {
			togglelinks: 'Pokaż/Ukryj Linki',
			stream: 'Stream',
			adaptive: 'Adaptywne',
			videoid: 'ID filmu: ',
			inbrowser_adaptive_merger: 'Połącz audio i wideo adaptywne w przeglądarce (FFmpeg)',
			dlmp4: 'Pobierz .mp4 w najwyższej jakości'
		},
		hi: {
			togglelinks: 'लिंक टॉगल करें',
			stream: 'स्ट्रीमिंग (Stream)',
			adaptive: 'अनुकूली (Adaptive)',
			videoid: 'वीडियो आईडी: {{id}}'
		},
		ru: {
			togglelinks: 'Показать/Cкрыть ссылки',
			stream: 'Поток',
			adaptive: 'Адаптивный',
			videoid: 'Идентификатор видео: ',
			inbrowser_adaptive_merger: 'Адаптивное слияние видео и аудио онлайн (FFmpeg)',
			dlmp4: 'Скачать mp4 в высоком разрешении в один клик',
			get_video_failed:
				'Не удалось получить информацию о видео по неизвестной причине, попробуйте обновить страницу.',
			live_stream_disabled_message: 'Локальный загрузчик YouTube недоступен для прямой трансляции'
		},
		ua: {
			togglelinks: 'Показати/Приховати посилання',
			stream: 'Потік',
			adaptive: 'Адаптивний',
			videoid: 'Ідентифікатор відео: ',
			inbrowser_adaptive_merger: 'Адаптивне злиття відео і аудіо онлайн (FFmpeg)',
			dlmp4: 'Завантажити mp4 у високій роздільній здатності в один клік',
			get_video_failed:
				'Не вдалося отримати інформацію про відео з невідомої причини, спробуйте оновити сторінку.',
			live_stream_disabled_message: 'Локальний завантажувач YouTube недоступний для прямої трансляції'
		},
		cs: {
			togglelinks: 'Zobrazit/Skrýt odkazy',
			stream: 'Stream',
			adaptive: 'Adaptivní',
			videoid: 'ID videa: ',
			inbrowser_adaptive_merger: 'Online nástroj pro sloučení videa a audia (FFmpeg)',
			dlmp4: 'Stáhnout video mp4 jedním kliknutím ve vysokém rozlišení',
			get_video_failed: 'Nepodařilo se nahrát informace o videu. Zkuste obnovit stránku (F5).',
			live_stream_disabled_message: 'Local YouTube Downloader není dostupný pro živé vysílání'
		}
	}
	for (const [lang, data] of Object.entries(LOCALE)) {
		if (lang === LANG_FALLBACK) continue
		for (const key of Object.keys(LOCALE[LANG_FALLBACK])) {
			if (!(key in data)) {
				data[key] = LOCALE[LANG_FALLBACK][key]
			}
		}
	}
	const findLang = l => {
		l = l.replace('-Hant', '') // special case for zh-Hant-TW
		// language resolution logic: zh-tw --(if not exists)--> zh --(if not exists)--> LANG_FALLBACK(en)
		l = l.toLowerCase().replace('_', '-')
		if (l in LOCALE) return l
		else if (l.length > 2) return findLang(l.split('-')[0])
		else return LANG_FALLBACK
	}
	const getLangCode = () => {
		const html = document.querySelector('html')
		if (html) {
			return html.lang
		} else {
			return navigator.language
		}
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
			const fnnameresult = /=([a-zA-Z0-9\$]+?)\(decodeURIComponent/.exec(data)
			const fnname = fnnameresult[1]
			const _argnamefnbodyresult = new RegExp(escapeRegExp(fnname) + '=function\\((.+?)\\){((.+)=\\2.+?)}').exec(
				data
			)
			const [_, argname, fnbody] = _argnamefnbodyresult
			const helpernameresult = /;(.+?)\..+?\(/.exec(fnbody)
			const helpername = helpernameresult[1]
			const helperresult = new RegExp('var ' + escapeRegExp(helpername) + '={[\\s\\S]+?};').exec(data)
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
	const parseResponse = (id, playerResponse, decsig) => {
		logger.log(`video %s playerResponse: %o`, id, playerResponse)
		let stream = []
		if (playerResponse.streamingData.formats) {
			stream = playerResponse.streamingData.formats.map(x =>
				Object.assign({}, x, parseQuery(x.cipher || x.signatureCipher))
			)
			logger.log(`video %s stream: %o`, id, stream)
			for (const obj of stream) {
				if (obj.s) {
					obj.s = decsig(obj.s)
					obj.url += `&${obj.sp}=${encodeURIComponent(obj.s)}`
				}
			}
		}

		let adaptive = []
		if (playerResponse.streamingData.adaptiveFormats) {
			adaptive = playerResponse.streamingData.adaptiveFormats.map(x =>
				Object.assign({}, x, parseQuery(x.cipher || x.signatureCipher))
			)
			logger.log(`video %s adaptive: %o`, id, adaptive)
			for (const obj of adaptive) {
				if (obj.s) {
					obj.s = decsig(obj.s)
					obj.url += `&${obj.sp}=${encodeURIComponent(obj.s)}`
				}
			}
		}
		logger.log(`video %s result: %o`, id, { stream, adaptive })
		return { stream, adaptive, details: playerResponse.videoDetails, playerResponse }
	}

	// video downloader
	const xhrDownloadUint8Array = async ({ url, contentLength }, progressCb) => {
		if (typeof contentLength === 'string') contentLength = parseInt(contentLength)
		progressCb({
			loaded: 0,
			total: contentLength,
			speed: 0
		})
		const chunkSize = 65536
    const getBuffer = (start, end) =>
      fetch(url + `&range=${start}-${end ? end - 1 : ''}`).then(r=>r.arrayBuffer())
		const data = new Uint8Array(contentLength)
		let downloaded = 0
		const queue = new pQueue.default({ concurrency: 6 })
		const startTime = Date.now()
		const ps = []
		for (let start = 0; start < contentLength; start += chunkSize) {
			const exceeded = start + chunkSize > contentLength
			const curChunkSize = exceeded ? contentLength - start : chunkSize
			const end = exceeded ? null : start + chunkSize
			const p = queue.add(() => {
        console.log('dl start', url, start, end)
				return getBuffer(start, end)
					.then(buf => {
            console.log('dl done', url, start, end)
						downloaded += curChunkSize
						data.set(new Uint8Array(buf), start)
						const ds = (Date.now() - startTime + 1) / 1000
						progressCb({
							loaded: downloaded,
							total: contentLength,
							speed: downloaded / ds
						})
					})
					.catch(err => {
						queue.clear()
						alert('Download error')
					})
      })
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
			`toolbar=no,height=${screen.height / 2},width=${screen.width / 2},left=${screenLeft},top=${screenTop}`
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
						.filter(x => x.mimeType.includes('video/mp4') || x.mimeType.includes('video/webm'))
						.map(v => {
							const [_, quality, fps] = /(\d+)p(\d*)/.exec(v.qualityLabel)
							v.qualityNum = parseInt(quality)
							v.fps = fps ? parseInt(fps) : 30
							return v
						})
						.sort((a, b) => {
							if (a.qualityNum === b.qualityNum) return b.fps - a.fps // ex: 30-60=-30, then a will be put before b
							return b.qualityNum - a.qualityNum
						})[0]
					const audioObj = adaptive.find(x => x.mimeType.includes('audio/mp4'))
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
					const result = await Promise.race([mergeVideo(varr, aarr), sleep(1000 * 25).then(() => null)])
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
  <template v-if="!isLiveStream">
    <div v-if="adaptive.length" class="of-h t-center c-pointer lh-20">
      <a class="fs-14px" @click="dlmp4" v-text="strings.dlmp4"></a>
    </div>
    <div @click="hide=!hide" class="box-toggle div-a t-center fs-14px c-pointer lh-20" v-text="strings.togglelinks"></div>
    <div :class="{'hide':hide}">
      <div class="t-center fs-14px" v-text="strings.videoid+id"></div>
      <div class="d-flex">
        <div class="f-1 of-h">
          <div class="t-center fs-14px" v-text="strings.stream"></div>
          <a class="ytdl-link-btn fs-14px" target="_blank" v-for="vid in stream" :href="vid.url" :title="vid.type" v-text="formatStreamText(vid)"></a>
        </div>
        <div class="f-1 of-h">
          <div class="t-center fs-14px" v-text="strings.adaptive"></div>
          <a class="ytdl-link-btn fs-14px" target="_blank" v-for="vid in adaptive" :href="vid.url" :title="vid.type" v-text="formatAdaptiveText(vid)"></a>
        </div>
      </div>
      <div class="of-h t-center">
        <a class="fs-14px" href="https://maple3142.github.io/mergemp4/" target="_blank" v-text="strings.inbrowser_adaptive_merger"></a>
      </div>
    </div>
  </template>
  <template v-else>
    <div class="t-center fs-14px lh-20" v-text="strings.live_stream_disabled_message"></div>
  </template>
</div>
`.slice(1)
	const app = new Vue({
		data() {
			return {
				hide: true,
				id: '',
				isLiveStream: false,
				stream: [],
				adaptive: [],
				details: null,
				dark: false,
				lang: findLang(getLangCode())
			}
		},
		computed: {
			strings() {
				return LOCALE[this.lang.toLowerCase()]
			}
		},
		methods: {
			dlmp4() {
				openDownloadModel(this.adaptive, this.details.title)
			},
			formatStreamText(vid) {
				return [vid.qualityLabel, vid.quality].filter(x => x).join(': ')
			},
			formatAdaptiveText(vid) {
				let str = [vid.qualityLabel, vid.mimeType].filter(x => x).join(': ')
				if (vid.mimeType.includes('audio')) {
					str += ` ${Math.round(vid.bitrate / 1000)}kbps`
				}
				return str
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
		unsafeWindow.parseResponse = parseResponse
	}
	const load = async playerResponse => {
		try {
			const basejs =
				(typeof ytplayer !== 'undefined' && 'config' in ytplayer && ytplayer.config.assets
					? 'https://' + location.host + ytplayer.config.assets.js
					: 'web_player_context_config' in ytplayer
					? 'https://' + location.host + ytplayer.web_player_context_config.jsUrl
					: null) || $('script[src$="base.js"]').src
			const decsig = await xf.get(basejs).text(parseDecsig)
			const id = parseQuery(location.search).v
			const data = parseResponse(id, playerResponse, decsig)
			logger.log('video loaded: %s', id)
			app.isLiveStream = data.playerResponse.playabilityStatus.liveStreamability != null
			app.id = id
			app.stream = data.stream
			app.adaptive = data.adaptive
			app.details = data.details

			const actLang = getLangCode()
			if (actLang != null) {
				const lang = findLang(actLang)
				logger.log('youtube ui lang: %s', actLang)
				logger.log('ytdl lang:', lang)
				app.lang = lang
			}
		} catch (err) {
			alert(app.strings.get_video_failed)
			logger.error('load', err)
		}
	}

	// hook fetch response
	const ff = fetch
	unsafeWindow.fetch = (...args) => {
		if (args[0] instanceof Request) {
			return ff(...args).then(resp => {
				if (resp.url.includes('player')) {
					resp.clone().json().then(load)
				}
				return resp
			})
		}
		return ff(...args)
	}

	// attach element
	setInterval(() => {
		const el =
			$('#info-contents') ||
			$('#watch-header') ||
			$('.page-container:not([hidden]) ytm-item-section-renderer>lazy-list')
		if (el && !el.contains(shadowHost)) {
			el.appendChild(shadowHost)
		}
	}, 100)

	// init
	unsafeWindow.addEventListener('load', () => {
		const firstResp = unsafeWindow?.ytplayer?.config?.args?.raw_player_response
		if (firstResp) {
			load(firstResp)
		}
	})

	// listen to dark mode toggle
	const $html = $('html')
	new MutationObserver(() => {
		app.dark = $html.getAttribute('dark') !== null
	}).observe($html, { attributes: true })
	app.dark = $html.getAttribute('dark') !== null

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
  padding-top: .5em;
  padding-bottom: .5em;
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
	color: var(--yt-endpoint-color, var(--yt-spec-text-primary));
}
.box.dark .ytdl-link-btn{
	color: var(--yt-endpoint-color, var(--yt-spec-text-primary));
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
	const css2 = `
/* https://greasyfork.org/zh-TW/scripts/369400-local-youtube-downloader/discussions/95744 */
#meta-contents,
#info-contents{
	display: contents !important;
}

ytd-watch-metadata.style-scope {
	display: none !important;
}
`
	document.body.appendChild($el('style', { textContent: css2 }))
})()
