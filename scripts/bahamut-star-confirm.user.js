// ==UserScript==
// @name         巴哈姆特收藏確認
// @namespace    https://blog.maple3142.net/
// @version      0.1
// @description  在收藏前彈出一個對話框詢問是否要收藏
// @author       maple3142
// @match        https://forum.gamer.com.tw/C.php?*
// @grant        none
// ==/UserScript==

;(function() {
	'use strict'

	const bak = FORUM_homeBookmark
	FORUM_homeBookmark = (...args) => {
		if (confirm('確認要收藏嗎?')) {
			bak.apply(null, args)
		}
	}
})()
