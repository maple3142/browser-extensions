// ==UserScript==
// @name         難以名狀的抓圖器 EX
// @namespace    https://blog.maple3142.net/
// @version      0.1
// @description  幫"難以名狀的抓圖器"加強了一些功能，方便抓圖
// @author       maple3142
// @match        https://neko.maid.tw/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      cdn-pixiv.maid.tw
// @connect      cdn-pixiv.maid.im
// @connect      cdn-pixiv.lolita.tw
// @connect      pcdn1.ha2.tw
// @connect      pcdn2.ha2.tw
// @require      https://unpkg.com/medium-zoom@0.4.0/dist/medium-zoom.min.js
// @compatible   firefox >=52
// @compatible   chrome >=55
// ==/UserScript==

;(function() {
	'use strict'
	const KEYCODE_TO_SAVE = 83 // s

	const $ = s => document.querySelector(s)
	const $$ = s => [...document.querySelectorAll(s)]
	const $el = (tag, cb) => {
		const el = document.createElement(tag)
		if (typeof cb === 'function') cb(el)
		return el
	}
	const getImgData = (site, id) => {
		if (GM_getValue(site + id, null) !== null) {
			return Promise.resolve(GM_getValue(site + id))
		} else {
			return fetch(`/api/retrieve.json?site=${site}&artwork_id=${id}`, { credentials: 'include' })
				.then(r => r.json())
				.then(data => {
					if (data.error) return
					data.photos = data.photos.map(x => ({ ...x, url: x.url.replace(/&amp;/g, '&') }))
					GM_setValue(site + id, data)
					return data
				})
		}
	}
	const saveImg = url =>
		GM_xmlhttpRequest({
			method: 'GET',
			url,
			responseType: 'blob',
			onload: xhr => {
				const bloburl = URL.createObjectURL(xhr.response)
				$el('a', a => {
					a.href = bloburl
					a.download = new URL(url).pathname.split('/').pop()
					document.body.appendChild(a)
					a.click()
					a.remove()
				})
			}
		})
	const getSource = (site, id) => {
		console.log(site, id)
		switch (site) {
			case 'pixiv':
				return `https://www.pixiv.net/member_illust.php?mode=medium&illust_id=${id}`
				break
			case 'nico':
				return `http://seiga.nicovideo.jp/seiga/${id}`
				break
			case 'tinami':
				return `https://www.tinami.com/view/${id.slice(2)}`
				break
			default:
				throw new Error('Invalid site!')
		}
	}
	const imgs = $$('#thumb_list>li>a>img')
	const ps = imgs.map(img => {
		const [, site, , id] = new URL(img.parentNode.href).pathname.split('/')
		return getImgData(site, id).then(data => {
			if (data) img.dataset.zoomTarget = data.photos[0].url
		})
	})
	Promise.all(ps)
		.then(() => mediumZoom('#thumb_list>li>a>img'))
		.then(() => {
			window.addEventListener('keydown', e => {
				if (e.which !== KEYCODE_TO_SAVE) return
				const el = $('img:hover')
				if (!el) return
				if (el.dataset.zoomTarget) {
					const [, site, , id] = new URL(el.parentNode.href).pathname.split('/')
					getImgData(site, id).then(data => data.photos.map(x => x.url).map(saveImg))
				} else saveImg(el.src)
			})
		})
		.then(() => {
			const handler = e => {
				let el = e.target
				while (el && el !== document) {
					if (el.classList.contains('ex-ctxmenu')) break
					el = el.parentNode
				}
				$$('.ex-ctxmenu').forEach(el => (el.style.display = 'none'))
				if (el && el !== document) {
					el.style.display = 'block'
				}
			}
			window.addEventListener('click', handler)
			window.addEventListener('contextmenu', handler)
			for (const img of imgs) {
				const [, site, , id] = new URL(img.parentNode.href).pathname.split('/')
				const ctxmenu = $el('div', ctxmenu => {
					ctxmenu.style.display = 'none'
					ctxmenu.classList.add('ex-ctxmenu')
				})
				const save = $el('div', save => {
					save.textContent = '儲存'
					save.classList.add('item')
					save.addEventListener('click', () =>
						getImgData(site, id).then(data => data.photos.map(x => x.url).map(saveImg))
					)
					ctxmenu.appendChild(save)
				})
				const goSource = $el('div', goSource => {
					goSource.textContent = '前往來源'
					goSource.classList.add('item')
					goSource.addEventListener('click', () => window.open(getSource(site, id), '_blank'))
					ctxmenu.appendChild(goSource)
				})
				document.body.appendChild(ctxmenu)
				img.addEventListener('contextmenu', e => {
					e.preventDefault()
					e.stopPropagation()
					$$('.ex-ctxmenu').forEach(el => (el.style.display = 'none'))
					ctxmenu.style.left = e.x + 'px'
					ctxmenu.style.top = e.y + 'px'
					ctxmenu.style.display = 'block'
				})
			}
		})
		.then(() => ($('.panel-heading').innerHTML += '<font color="red">一鍵存圖 已準備完成</font>'))
	GM_addStyle(`
.medium-zoom-image,.medium-zoom-overlay{
z-index:10;
}
.ex-ctxmenu{
border:solid 1px;
border-radius:3px;
position:absolute;
height:40x;
width:100px;
background-color:white;
}
.ex-ctxmenu .item{
display:flex;
align-items:center;
justify-content:center;
padding:5px;
height:20px;
}
.ex-ctxmenu .item:hover{
background-color:lightgray;
}
`)
})()
