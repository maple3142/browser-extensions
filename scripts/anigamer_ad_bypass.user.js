// ==UserScript==
// @name         anigamer_ad_bypass
// @namespace    https://blog.maple3142.net/
// @version      0.1
// @description  bypass anigamer ad
// @author       maple3142
// @match        https://ani.gamer.com.tw/animeVideo.php?sn=*
// @grant        none
// ==/UserScript==

;(() => {
	'use strict'
	const $ = s => document.querySelector(s)
	function tryClick() {
		const el = $('#adult')
		if (el) el.click()
		setTimeout(tryClick, 10)
	}
	async function test() {
		const p = new URLSearchParams(location.search)
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
			require(['order!init'], w => w.initialize())
			$('.vast-skip-button').remove()
		} else {
			console.log('failed')
			setTimeout(test, 100)
		}
	}
	tryClick()
	test()
})()
