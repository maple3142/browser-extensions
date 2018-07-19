// ==UserScript==
// @name         Pixiv 一鍵收藏 EX
// @namespace    https://blog.maple3142.net/
// @version      0.3
// @description  強化版的 pixiv 一鍵收藏，支援收藏與取消
// @author       maple3142
// @match        https://www.pixiv.net/member_illust.php?mode=medium&illust_id=*
// @grant        none
// @compatible   firefox >=52
// @compatible   chrome >=55
// ==/UserScript==

;(function() {
	'use strict'
	const $ = (s, el = document) => el.querySelector(s)
	const $$ = (s, el = document) => [...el.querySelectorAll(s)]
	const qs = o =>
		Object.keys(o)
			.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(o[k])}`)
			.join('&')
	const getData = id =>
		fetch(`https://www.pixiv.net/ajax/illust/${id}/bookmarkData`, {
			method: 'GET',
			credentials: 'include'
		}).then(r => r.json())
	const doPost = url => data =>
		fetch(url, {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: qs(data)
		})
	const doBookmark = id =>
		doPost('https://www.pixiv.net/rpc/index.php')({
			mode: 'save_illust_bookmark',
			illust_id: id,
			restrict: 0,
			comment: '',
			tags: '',
			tt: globalInitData.token
		})
			.then(r => r.json())
			.then(r => {
				if (r.error) throw new Error(r)
				return r
			})
	const unBookmark = id =>
		getData(id).then(d =>
			doPost('https://www.pixiv.net/bookmark_setting.php')({
				tt: globalInitData.token,
				p: 1,
				untagged: 0,
				rest: 'show',
				'book_id[]': d.body.bookmarkData.id,
				del: 1
			})
		)
	const bookmarked = new WeakMap()
	new MutationObserver(mut => {
		const el = $('figure>div>div>section>div>a[href*=bookmark_add]')
		if (el && !bookmarked.has(el)) {
			bookmarked.set(el, false)
			const [border, heart] = $$('path', el)
			if (!el.classList.contains('gtm-main-bookmark')) {
				bookmarked.set(el, true)
			}
			el.addEventListener('click', e => {
				e.preventDefault()
				e.stopPropagation()
				if (!bookmarked.get(el)) {
					doBookmark(new URLSearchParams(location.search).get('illust_id'))
						.then(r => {
							border.style.fill = heart.style.fill = '#FF4060'
							bookmarked.set(el, true)
						})
						.catch(() => alert('Failed to bookmark!'))
				} else {
					unBookmark(new URLSearchParams(location.search).get('illust_id'))
						.then(r => {
							heart.style.fill = '#FFFFFF'
							border.style.fill = '#333'
							bookmarked.set(el, false)
						})
						.catch(() => alert('Failed to unbookmark!'))
				}
			})
		}
	}).observe(document.body, {
		childList: true,
		subtree: true
	})
})()
