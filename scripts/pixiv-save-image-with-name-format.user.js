// ==UserScript==
// @name         Pixiv save image with name format
// @namespace    https://blog.maple3142.net/
// @version      0.1
// @description  Save pixiv image with custom name format
// @author       maple3142
// @match        https://www.pixiv.net/member_illust.php?mode=medium&illust_id=*
// @connect      pximg.net
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// ==/UserScript==

;(function() {
	'use strict'
	const FILENAME_TEMPLATE = '{{title}}-{{userName}}-{{id}}'

	const $ = s => document.querySelector(s)
	const $$ = s => [...document.querySelectorAll(s)]
	const elementmerge = (a, b) => {
		Object.keys(b).forEach(k => {
			if (typeof b[k] === 'object') elementmerge(a[k], b[k])
			else if (k in a) a[k] = b[k]
			else a.setAttribute(k, b[k])
		})
	}
	const $el = (s, o) => {
		const el = document.createElement(s)
		elementmerge(el, o)
		return el
	}
	const debounce = delay => fn => {
		let de = false
		return (...args) => {
			if (de) return
			de = true
			fn(...args)
			setTimeout(() => (de = false), delay)
		}
	}
	const download = (url, fname) => {
		const a = $el('a', { href: url, download: fname || true })
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
	}
	const gmxhr = o => new Promise((res, rej) => GM_xmlhttpRequest({ ...o, onload: res, onerror: rej }))

	function main() {
		const params = new URLSearchParams(location.search)
		const getIllustData = (id = params.get('illust_id')) =>
			fetch(`/ajax/illust/${id}`, { credentials: 'same-origin' })
				.then(r => r.json())
				.then(r => r.body)
		const saveImage = (format = FILENAME_TEMPLATE, id = params.get('illust_id')) => {
			getIllustData(id)
				.then(data => {
					const fname = format.replace(/{{(\w+?)}}/g, (m, g1) => data[g1])
					const url = data.urls.original
					const ext = url
						.split('/')
						.pop()
						.split('.')
						.pop()
					return Promise.all([
						fname + '.' + ext,
						gmxhr({
							method: 'GET',
							url,
							responseType: 'blob',
							headers: { Referer: 'https://www.pixiv.net/' }
						})
					])
				})
				.then(([f, xhr]) => {
					const url = URL.createObjectURL(xhr.response)
					download(url, f)
					URL.revokeObjectURL(xhr.response)
				})
		}
		const observer = new MutationObserver(
			debounce(10)(mut => {
				const menu = $('ul[role=menu]')
				if (!menu) return
				const n = menu.children.length
				const item = $el('li', { role: 'menuitem', onclick: () => saveImage() })
				item.className = menu.children[n - 2].className
				const text = $el('span', { textContent: '⬇' })
				item.appendChild(text)
				menu.insertBefore(item, menu.children[n - 1])
			})
		)
		const start = () => observer.observe($('.sticky'), { childList: true, subtree: true })
		if (!$('.sticky')) setTimeout(start, 1000)
		else start()
		if (!unsafeWindow.__$maple3142$_savePivivImage)
			Object.defineProperty(unsafeWindow, '__$maple3142$_savePivivImage', {
				get: () => saveImage,
				enumerable: false
			})
	}

	//ajax change
	let lasturl
	setInterval(() => {
		if (location.href == lasturl) return
		lasturl = location.href
		main()
	}, 1000)
})()
