// ==UserScript==
// @name         跳過動畫瘋廣告
// @namespace    https://blog.maple3142.net/
// @version      0.4
// @description  RT
// @author       maple3142
// @match        https://ani.gamer.com.tw/animeVideo.php?sn=*
// @require      https://unpkg.com/xfetch-js@0.1.6/xfetch.min.js
// @grant        none
// @compatible   firefox >=52
// @compatible   chrome >=55
// @license      MIT
// ==/UserScript==

;(function() {
	'use strict'
	const sn = animefun.videoSn
	const device = animefun.getdeviceid()
	const obj = { sn, s: getAd()[0] }
	xf.get('/ajax/videoCastcishu.php', { qs: obj })
		.then(() => xf.get('/ajax/videoCastcishu.php', { qs: { ...obj, ad: 'end' } }))
		.then(() => xf.get('/ajax/m3u8.php', { sn, device }))
})()
