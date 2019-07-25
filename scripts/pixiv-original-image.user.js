// ==UserScript==
// @name         Pixiv Replace With Original
// @name:zh-TW   Pixiv 替換為高畫質原圖
// @name:zh-CN   Pixiv 替换为高画质原图
// @namespace    https://blog.maple3142.net/
// @version      0.4
// @description  Replace Pixiv image with original image
// @description:zh-TW  替換 Pixiv 的圖片為高畫質原圖
// @description:zh-CN  替换 Pixiv 的图片为高画质原图
// @author       maple3142
// @match        https://www.pixiv.net/member_illust.php?mode=medium&illust_id=*
// @match        https://www.pixiv.net/member_illust.php?illust_id=*&mode=medium
// @compatible   firefox >=52
// @compatible   chrome >=55
// ==/UserScript==

;(function() {
	'use strict'
	const $ = s => document.querySelector(s)
	const $$ = s => [...document.querySelectorAll(s)]
	function onDomChange(cb) {
		new MutationObserver(() => setTimeout(cb, 50)).observe(document.body, { childList: true })
	}
	function replaceImage() {
		const els = $$('div[role=presentation]>a')
		for (const a of els) {
			const image = a.querySelector('img')
			image.src = a.href
			image.srcset = ''
		}
	}
	onDomChange(replaceImage)
})()
