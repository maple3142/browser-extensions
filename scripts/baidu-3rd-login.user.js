// ==UserScript==
// @name         百度第三方登入
// @namespace    https://blog.maple3142.net/
// @version      0.1
// @description  把不能使用第三方登入的都改成能使用的
// @author       maple3142
// @match        *://*.baidu.com/*
// @grant        none
// @compatible   firefox >=52
// @compatible   chrome >=55
// ==/UserScript==

;(function() {
	'use strict'
	const $ = s => document.querySelector(s)
	const $el = (tag, after) => {
		const el = document.createElement(tag)
		if (typeof after === 'function') after(el)
		return el
	}
	const clearChild = el => {
		while (el.firstChild) el.removeChild(el.firstChild)
	}
	if (top === window) {
		// normal page login
		const lif = $el('iframe', lif => {
			lif.src = 'https://passport.baidu.com/v2/login'
			lif.style.height = '430px'
			lif.style.width = '100%'
			lif.style.overflow = 'hidden'
			lif.scrolling = 'no'
			lif.frameBorder = '0'
		})
		const id = setInterval(() => {
			const lg = $('#passport-login-pop-dialog')
			if (!lg) return
			if (lg.contains(lif)) return
			clearChild(lg)
			lg.appendChild(lif)
		}, 100)
	}
	if (location.href === 'https://passport.baidu.com/v2/login' && top !== window) {
		// login page in iframe
		const it = setInterval(() => {
			const lf = $('.login-form')
			if (!lf) return
			clearInterval(it)
			const els = document.body.children
			for (const el of els) {
				el.style.display = 'none'
			}
			document.body.appendChild(lf)
			lf.style.float = 'none'
			lf.style.border = 'none'
			lf.style.paddingTop = '0'
			$el('h1', h1 => {
				h1.textContent = '登入成功後請手動重整'
				h1.style.textAlign = 'center'
				h1.style.paddingTop = '5px'
				document.body.appendChild(h1)
			})
		}, 100)
	}
})()
