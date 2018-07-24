// ==UserScript==
// @name         巴哈姆特 mediumZoom
// @namespace    https://blog.maple3142.net/
// @version      0.1
// @description  把巴哈姆特的文章圖片瀏覽器改為 mediumZoom
// @author       maple3142
// @match        https://forum.gamer.com.tw/C.php?*
// @match        https://forum.gamer.com.tw/Co.php?*
// @match        https://forum.gamer.com.tw/G2.php?*
// @match        https://home.gamer.com.tw/creationDetail.php?sn=*
// @match        https://gnn.gamer.com.tw/*
// @require      https://unpkg.com/medium-zoom@0/dist/medium-zoom.min.js
// @grant        none
// @compatible   firefox >=52
// @compatible   chrome >=55
// @license      MIT
// ==/UserScript==

;(function($) {
	'use strict'
	const rmevt = s =>
		$(s)
			.toArray()
			.forEach(x => x.parentNode.replaceChild(x.cloneNode(), x))
	if (location.hostname === 'forum.gamer.com.tw') {
		$('.c-article__content').off()
		mediumZoom('a.photoswipe-image>img')
	}
	if (location.hostname === 'home.gamer.com.tw') {
		rmevt('.gallery-image')
		mediumZoom('.gallery-image')
	}
	if (location.hostname === 'gnn.gamer.com.tw') {
		rmevt('.GN-thumbnail>img')
		mediumZoom('.GN-thumbnail>img')
	}
})(jQuery)
