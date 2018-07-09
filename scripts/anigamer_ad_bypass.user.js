// ==UserScript==
// @name         anigamer_ad_bypass
// @namespace    https://blog.maple3142.net/
// @version      0.1
// @description  bypass anigamer ad
// @author       maple3142
// @match        https://ani.gamer.com.tw/animeVideo.php?sn=*
// @grant        unsafeWindow
// ==/UserScript==

;(async () => {
	'use strict'
	const $ = s => document.querySelector(s)
	const $$ = s => [...document.querySelectorAll(s)]
	let hasFailed = false
	await fetch(`/ajax/videoCastcishu.php?sn=${animefun.videoSn}&s=${getAd()[0]}`, {
		credentials: 'same-origin'
	}).then(r => r.text())
	await fetch(`/ajax/videoCastcishu.php?sn=${animefun.videoSn}&s=${getAd()[0]}&ad=end`, {
		credentials: 'same-origin'
	}).then(r => r.text())
	const { src } = await fetch(`/ajax/m3u8.php?sn=${animefun.videoSn}&device=${animefun.getdeviceid()}`, {
		credentials: 'same-origin'
	}).then(r => r.json())
	if (src) console.log('success: %s', src)
})()
