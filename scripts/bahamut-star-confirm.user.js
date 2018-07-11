// ==UserScript==
// @name         巴哈姆特收藏確認
// @namespace    https://blog.maple3142.net/
// @version      0.2
// @description  在收藏前彈出一個對話框詢問是否要收藏
// @author       maple3142
// @match        https://forum.gamer.com.tw/C.php?*
// @match        https://home.gamer.com.tw/*
// @grant        none
// @compatible   firefox >=52
// @compatible   chrome >=55
// ==/UserScript==

;(function() {
	'use strict'
	if (typeof FORUM_homeBookmark !== 'undefined')
		FORUM_homeBookmark = (fn => (...args) => {
			if (confirm('確認要收藏嗎?')) {
				fn(...args)
			}
		})(FORUM_homeBookmark)
	if (typeof homeBookmarkNew !== 'undefined')
		homeBookmarkNew = (fn => (...args) => {
			if (confirm('確認要收藏嗎?')) {
				fn(...args)
			}
		})(homeBookmarkNew)
})()
