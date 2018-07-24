// ==UserScript==
// @name         Anigamer ad bypasser
// @namespace    https://blog.maple3142.net/
// @version      0.1
// @description  Bypass ani.gamer.com.tw ads
// @author       maple3142
// @match        https://ani.gamer.com.tw/animeVideo.php?sn=*
// @grant        none
// @compatible   firefox >=52
// @compatible   chrome >=55
// @license      MIT
// ==/UserScript==

;(function() {
	'use strict'
	const sn = animefun.videoSn
	const device = animefun.getdeviceid()
	const qs = o =>
		Object.keys(o)
			.map(k => `${k}=${encodeURIComponent(o[k])}`)
			.join('&')
	const get = url => o => fetch(url + '?' + qs(o), { credentials: 'same-origin' })
	const getVC = get('/ajax/videoCastcishu.php')
	const getM3u8 = get('/ajax/m3u8.php')
	const obj = { sn, s: getAd()[0] }
	getVC(obj)
		.then(() => getVC({ ...obj, ad: 'end' }))
		.then(() => getM3u8({ sn, device }).then(r => r.json()))
		.then(({ src }) => {
			if (src) console.log('success: %s', src)
		})
})()
