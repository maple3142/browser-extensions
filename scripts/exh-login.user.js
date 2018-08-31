// ==UserScript==
// @name         ExH login
// @namespace    https://blog.maple3142.net/
// @version      0.1
// @description  Login to exhentai without modifying cookie by your self.
// @author       maple3142
// @connect      e-hentai.org
// @require      https://code.jquery.com/jquery-3.2.1.slim.min.js
// @match        https://exhentai.org/
// @grant        GM_xmlhttpRequest
// ==/UserScript==

;(function($) {
	'use strict'

	const $ct = $('<div>')
		.css('position', 'absolute')
		.css('height', '100%')
		.css('width', '100%')
		.css('background-color', 'white')
	const $lgb = $('<div>')
		.css('position', 'absolute')
		.css('left', '50%')
		.css('top', '50%')
		.css('transform', 'translateX(-50%) translateY(-50%)')
		.css('display', 'flex')
		.css('align-items', 'center')
		.css('width', '30%')
	const $ac = $('<input>')
	const $acl = $('<label>')
		.text('ac: ')
		.css('flex', 1)
		.append($ac)
	const $pw = $('<input>')
	const $pwl = $('<label>')
		.text('pw: ')
		.css('flex', 1)
		.append($pw)
		.attr('type', 'password')
	const $lg = $('<button>').text('Login')
	$lgb.append($acl)
		.append($pwl)
		.append($lg)
	$ct.append($lgb)

	$lg.on('click', e => doLogin($ac.val(), $pw.val()))

	function parseHeaders(h) {
		return Object.assign(
			...h
				.split('\n')
				.map(x => x.split(/:\s+/))
				.map(([k, v]) => ({ [k]: v }))
		)
	}
	function doLogin(UserName, PassWord) {
		GM_xmlhttpRequest({
			url: 'https://forums.e-hentai.org/index.php?act=Login&CODE=01',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			data: `UserName=${UserName}&PassWord=${PassWord}&ipb_login_submit=Login!&b=d&bt=1-1&CookieDate=1`,
			onload: xhr => {
				const res = xhr.responseText
				const h = parseHeaders(xhr.responseHeaders)
				if (res && res.includes('You are now logged in as')) {
					document.cookie = 'yay=louder; Max-Age=0; path=/; domain=.exhentai.org'
					for (const tok of h['set-cookie'].split(',')) {
						document.cookie = tok.replace(/e-hentai/, 'exhentai')
					}
					location.href = location.href
				}
			},
			onerror: console.error
		})
	}

	if ($('img[src="https://exhentai.org/"]').length) {
		$(document.body).append($ct)
		//if(ac&&pw)doLogin(ac,pw)
	}
	document.cookie = document.cookie.replace('yay=louder', '')
})(jQuery.noConflict())
