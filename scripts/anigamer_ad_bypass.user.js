// ==UserScript==
// @name         anigamer_ad_bypass
// @namespace    https://blog.maple3142.net/
// @version      0.1
// @description  bypass anigamer ad
// @author       maple3142
// @match        https://ani.gamer.com.tw/animeVideo.php?sn=*
// @grant        unsafeWindow
// ==/UserScript==

;(() => {
	'use strict'
	const sn = animefun.videoSn
	const device = animefun.getdeviceid()
	const xhr = (url, o) => fetch(url, { ...o, credentials: 'same-origin' })
	const qs = o =>
		Object.keys(o)
			.map(k => `${k}=${encodeURIComponent(o[k])}`)
			.join('&')
	const obj = { sn, s: getAd()[0] }
	xhr(`/ajax/videoCastcishu.php?` + qs(obj))
		.then(() => xhr(`/ajax/videoCastcishu.php?` + qs({ ...obj, ad: 'end' })))
		.then(() => xhr(`/ajax/m3u8.php?` + qs({ sn, device })).then(r => r.json()))
		.then(({ src }) => {
			if (src) console.log('success: %s', src)
		})
})()
