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
	const $ = s => document.querySelector(s)
	const $$ = s => [...document.querySelectorAll(s)]
	let hasFailed = false
	async function test() {
		if ($('#adult')) {
			$('#adult').click()
		}
		await fetch(
			`/ajax/token.php?adID=${getAd()[0]}&sn=${animefun.videoSn}&device=${animefun.getdeviceid()}&hash=${
				animefun.uuid
			}`,
			{ credentials: 'same-origin' }
		)
		await fetch(`/ajax/videoCastcishu.php?sn=${animefun.videoSn}&s=${getAd()[0]}&ad=end`, {
			credentials: 'same-origin'
		}).then(r => r.text())
		const { src } = await fetch(`/ajax/m3u8.php?sn=${animefun.videoSn}&device=${animefun.getdeviceid()}`, {
			credentials: 'same-origin'
		}).then(r => r.json())
		if (src) {
			if (hasFailed) location.reload()
		} else {
			console.log('failed')
			hasFailed = true
			setTimeout(test, 100)
		}
	}
	test()

	console.error = (fn => (...args) => {
		if (args[0].includes('AD ERROR: VAST Error')) location.reload()
		fn(...args)
	})(console.error)
})()
