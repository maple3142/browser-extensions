// ==UserScript==
// @name         跳過動畫瘋廣告
// @namespace    https://blog.maple3142.net/
// @version      0.5
// @description  RT
// @author       maple3142
// @match        https://ani.gamer.com.tw/animeVideo.php?sn=*
// @require      https://unpkg.com/xfetch-js@0.2.1/xfetch.min.js
// @grant        none
// @compatible   firefox >=52
// @compatible   chrome >=55
// @license      MIT
// ==/UserScript==

;(function() {
	'use strict'
	const sn = animefun.videoSn
	const device = animefun.getdeviceid()
	const s = getAd()
	const sleep = ms => new Promise(res => setTimeout(res, ms))
	const startad = () => xf.get('/ajax/videoCastcishu.php', { qs: { sn, s } }).text()
	const endad = () => xf.get('/ajax/videoCastcishu.php', { qs: { sn, s, ad: 'end' } }).text()
	const getm3u8 = () => xf.get('/ajax/m3u8.php', { qs: { sn, device } }).json()

	const skipad = () =>
		startad()
			.then(() => sleep(3000))
			.then(endad)
			.then(getm3u8)
			.then(console.log)
			.then(() => location.reload())
	getm3u8().then(r => (r.src ? null : skipad()))
})()
