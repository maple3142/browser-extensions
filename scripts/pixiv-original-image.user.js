// ==UserScript==
// @name         Pixiv Replace With Original
// @name:zh-TW   Pixiv 替換為高畫質原圖
// @name:zh-CN   Pixiv 替换为高画质原图
// @namespace    https://blog.maple3142.net/
// @version      0.3
// @description  Replace Pixiv image with original image
// @description:zh-TW  替換 Pixiv 的圖片為高畫質原圖
// @description:zh-CN  替换 Pixiv 的图片为高画质原图
// @author       maple3142
// @match        https://www.pixiv.net/member_illust.php?mode=medium&illust_id=*
// @match        https://www.pixiv.net/member_illust.php?mode=manga&illust_id=*
// @run-at       document-start
// @grant        unsafeWindow
// @compatible   firefox >=52
// @compatible   chrome >=55
// ==/UserScript==

;(function() {
	'use strict'
	const $ = s => document.querySelector(s)
	const $$ = s => [...document.querySelectorAll(s)]
	const params = new URLSearchParams(location.search)
	const mode = params.get('mode')
	if (mode === 'medium') {
		const PREFIX = Math.random().toString(36)
		Object.defineProperty(Object.prototype, 'props', {
			set(v) {
				this[PREFIX + '_props'] = v
				if (v && v.urls) onTarget(this)
			},
			get(v) {
				return this[PREFIX + '_props']
			}
		})
		function onTarget(target) {
			const url = target.props.urls.original
			target.props.urls = new Proxy(
				{},
				{
					get: () => url
				}
			)
		}
	} else if (mode === 'manga') {
		const id = params.get('illust_id')
		const p = fetch(`/ajax/illust/${id}`, { credentials: 'same-origin' })
			.then(r => r.json())
			.then(r => r.body)
			.then(data => {
				const url = data.urls.original
				const ar = []
				for (let i = 0; i < data.pageCount; i++) {
					ar.push(url.replace('p0', `p${i}`))
				}
				return ar
			})
		addEventListener('load', () => {
			p.then(ar => {
				const imgs = $$('img.image')
				for (let i = 0; i < ar.length; i++) {
					imgs[i].src = imgs[i].dataset.src = ar[i]
				}
			})
		})
	}
})()
