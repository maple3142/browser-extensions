// ==UserScript==
// @name         跳過動畫瘋廣告
// @namespace    https://blog.maple3142.net/
// @version      0.6
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
	const css = document.createElement('style')
	css.textContent = `.vast-blocker{background:black;}.vast-blocker::before{content:"約8秒後會自動跳過廣告，失敗就重新整理";color:white;font-size:70px;}`
	document.body.appendChild(css)
	let tryCount = 0
	function tryUntilAniVideoIsOk() {
		tryCount++
		if (typeof ani_video === 'undefined' || typeof ani_video.on === 'undefined') {
			if (tryCount > 3) {
				alert('跳過動畫瘋廣告腳本需要動畫瘋工具箱才能運作，請安裝')
				window.open(
					'https://greasyfork.org/zh-TW/scripts/39136-%E5%8B%95%E7%95%AB%E7%98%8B%E5%B7%A5%E5%85%B7%E7%AE%B1',
					'_blank'
				)
			} else {
				setTimeout(tryUntilAniVideoIsOk, 1000)
			}
			return
		}
		ani_video.on('vast.adStart', () => {
			setTimeout(() => ani_video.trigger('vast.adSkip'), 8000)
		})
	}
	tryUntilAniVideoIsOk()
})()
