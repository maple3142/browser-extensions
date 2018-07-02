// ==UserScript==
// @name         Local YouTube Downloader
// @name:zh-TW   本地 YouTube 下載器
// @name:zh-CN   本地 YouTube 下载器
// @namespace    https://blog.maple3142.net/
// @version      0.4.1
// @description  Get youtube raw link without external service.
// @description:zh-TW  不需要透過第三方的服務就能下載 YouTube 影片。
// @description:zh-CN  不需要透过第三方的服务就能下载 YouTube 影片。
// @author       maple3142
// @match        https://www.youtube.com/*
// @run-at       document-start
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

;(function() {
	'use strict'
	const $ = (s, x = document) => x.querySelector(s)
	const $$ = (s, x = document) => [...x.querySelectorAll(s)]
	const isobj = o => o && typeof o === 'object' && !Array.isArray(o)
	const deepmerge = (o, o1) => {
		for (const k of Object.keys(o1)) {
			if (isobj(o1[k])) {
				if (!(k in o)) o[k] = o1[k]
				else deepmerge(o[k], o1[k])
			} else o[k] = o1[k]
		}
		return o
	}
	const $el = (tag, { props = {}, events = {}, children = [] } = {}) => {
		const el = document.createElement(tag)
		for (const k of Object.keys(props)) {
			if (k in el && isobj(el[k])) deepmerge(el[k], props[k])
			else if (k in el) el[k] = props[k]
			else el.setAttribute(k, props[k])
		}
		for (const k of Object.keys(events)) {
			el.addEventListener(k, events[k])
		}
		for (const c of children) {
			el.appendChild(c)
		}
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
	class Component {
		constructor(el) {
			this.el = el
			this.state = this.getInitialState()
			this._render()
		}
		getInitialState() {
			return {}
		}
		setState(newstate) {
			Object.assign(this.state, newstate)
			this._render()
		}
		render() {
			throw new Error('Component must have a render function.')
		}
		_render() {
			while (this.el.firstChild) this.el.removeChild(this.el.firstChild)
			this.el.appendChild(this.render(this.state))
		}
	}
	class App extends Component {
		getInitialState() {
			return {
				hide: true,
				id: '',
				stream: [],
				adaptive: []
			}
		}
		toggleHide() {
			this.setState({ hide: !this.state.hide })
		}
		render(state) {
			return $el('div', {
				props: { id: 'ytdl-box', style: { zIndex: 10000 } },
				children: [
					$el('div', {
						props: {
							id: 'ytdl-box-toggle',
							style: { textAlign: 'center' },
							textContent: 'Toggle Links'
						},
						events: {
							click: this.toggleHide.bind(this)
						}
					}),
					$el('div', {
						props: { id: 'ytdl-content', style: { display: state.hide ? 'none' : 'block' } },
						children: [
							$el('div', {
								props: { id: 'ytdl-id', style: { textAlign: 'center' }, textContent: state.id }
							}),
							$el('div', {
								props: { id: 'ytdl-bbox', style: { display: 'flex' } },
								children: [
									$el('div', {
										props: { id: 'ytdl-stream', style: { flex: '1' } },
										children: state.stream.map(x =>
											$el('a', {
												props: {
													textContent: x.quality || x.type,
													href: x.url,
													title: x.type,
													target: '_blank',
													className: 'ytdl-link-btn'
												}
											})
										)
									}),
									$el('div', {
										props: { id: 'ytdl-adaptive', style: { flex: '1' } },
										children: state.adaptive.map(x =>
											$el('a', {
												props: {
													textContent:
														(x.quality_label ? x.quality_label + ':' : '') + x.type,
													href: x.url,
													title: x.type,
													target: '_blank',
													className: 'ytdl-link-btn'
												}
											})
										)
									})
								]
							})
						]
					})
				]
			})
		}
	}
	const container = $el('div')
	const app = new App(container)
	const load = async id => {
		const ytplayer = await getytplayer()
		const decsig = await getdecsig(ytplayer.config.assets.js)
		return workerGetVideo(id, decsig.meta)
			.then(data => {
				console.log('load new: %s', id)
				app.setState({ id, stream: data.stream, adaptive: data.adaptive })
			})
			.catch(err => console.error('load', err))
	}
	let prevurl = null
	setInterval(() => {
		const el = $('#info-contents')
		if (el && !el.contains(container)) el.appendChild(container)
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
