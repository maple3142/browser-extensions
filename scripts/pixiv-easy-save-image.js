// ==UserScript==
// @name         Pixiv easy save image
// @name:zh-TW   Pixiv 簡單存圖
// @name:zh-CN   Pixiv 简单存图
// @namespace    https://blog.maple3142.net/
// @version      0.2.2
// @description  Save pixiv image easily with custom name format and shortcut key.
// @description:zh-TW  透過快捷鍵與自訂名稱格式來簡單的存圖
// @description:zh-CN  透过快捷键与自订名称格式来简单的存图
// @author       maple3142
// @match        https://www.pixiv.net/member_illust.php?mode=medium&illust_id=*
// @include      /^https:\/\/www\.pixiv\.net/.*$/
// @match        https://www.pixiv.net/bookmark.php*
// @match        https://www.pixiv.net/new_illust.php*
// @match        https://www.pixiv.net/bookmark_new_illust.php*
// @connect      pximg.net
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==

;(function() {
	'use strict'
	const FILENAME_TEMPLATE = '{{title}}-{{userName}}-{{id}}'
	const KEYCODE_TO_SAVE = 83 // 's' key

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

	const getIllustData = id =>
		fetch(`/ajax/illust/${id}`, { credentials: 'same-origin' })
			.then(r => r.json())
			.then(r => r.body)
	const saveImage = (format, id) => {
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
					gmxhr({ method: 'GET', url, responseType: 'blob', headers: { Referer: 'https://www.pixiv.net/' } })
				])
			})
			.then(([f, xhr]) => {
				const url = URL.createObjectURL(xhr.response)
				download(url, f)
				URL.revokeObjectURL(xhr.response)
			})
	}

	if (location.pathname === '/member_illust.php') {
		//ajax change
		let lasturl
		setInterval(() => {
			if (location.href == lasturl) return
			lasturl = location.href
			main()
		}, 1000)

		function main() {
			const params = new URLSearchParams(location.search)
			const observer = new MutationObserver(
				debounce(10)(mut => {
					const menu = $('ul[role=menu]')
					if (!menu) return
					const n = menu.children.length
					const item = $el('li', {
						role: 'menuitem',
						onclick: () => saveImage(FILENAME_TEMPLATE, params.get('illust_id'))
					})
					item.className = menu.children[n - 2].className
					const text = $el('span', { textContent: '⬇' })
					item.appendChild(text)
					menu.insertBefore(item, menu.children[n - 1])
				})
			)
			const start = () => {
				const el = $('.sticky')
				if (!el) setTimeout(start, 1000)
				else observer.observe($('.sticky'), { childList: true, subtree: true })
			}
			start()
		}
	}

	// key shortcut
	{
		const SELECTOR_MAP = {
			'/': 'a.work',
			'/bookmark.php': 'a.work',
			'/new_illust.php': 'a.work',
			'/bookmark_new_illust.php': '.gtm-recommend-illust.gtm-thumbnail-link',
			'/member_illust.php': () => /\d+/.exec($('.sticky>section>div>a[href]').href)[0]
		}
		const IMG_SELECTOR = SELECTOR_MAP[location.pathname]
		const mouse = { x: 0, y: 0 }
		const isInRect = pos => rect =>
			pos.x >= rect.x && pos.x <= rect.x + rect.width && pos.y >= rect.y && pos.y <= rect.y + rect.height
		const isMouseInRect = isInRect(mouse)
		addEventListener('mousemove', e => {
			mouse.x = e.x
			mouse.y = e.y
		})
		addEventListener('keydown', e => {
			if (e.which !== KEYCODE_TO_SAVE) return // 's' key
			let id
			if (typeof IMG_SELECTOR === 'string') {
				const el = $$(IMG_SELECTOR).filter(x => isMouseInRect(x.getBoundingClientRect()))[0]
				if (!el) return
				id = /\d+/.exec(el.href)[0]
			} else {
				id = IMG_SELECTOR()
			}
			saveImage(FILENAME_TEMPLATE, id)
		})
	}

	// support Patchouli
	{
		let times = 0
		const it = setInterval(() => {
			if (times >= 10) clearInterval(it)
			if (typeof Patchouli !== 'undefined' && Patchouli._isMounted) {
				$$('.image-flexbox').map(x => x.classList.add('work'))
				const observer = new MutationObserver(
					debounce(10)(mut => $$('.image-flexbox').map(x => x.classList.add('work')))
					// add class=work to let them works
				)
				observer.observe(Patchouli.$el, { childList: true, subtree: true })
				console.log('Pixiv easy save image: Patchouli detected!')
				clearInterval(it)
				GM_addStyle(`.image-item .work{margin-bottom:0px!important;}`) // disable default css
			}
			times++
		}, 1000)
	}
})()
