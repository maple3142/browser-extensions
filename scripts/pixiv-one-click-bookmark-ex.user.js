// ==UserScript==
// @name         Pixiv 一鍵收藏 EX
// @namespace    https://blog.maple3142.net/
// @version      0.4.2
// @description  強化版的 pixiv 一鍵收藏，支援收藏與取消
// @author       maple3142
// @match        https://www.pixiv.net/member_illust.php?mode=medium&illust_id=*
// @grant        none
// @compatible   firefox >=52
// @compatible   chrome >=55
// ==/UserScript==

;(function(globalToken) {
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
		}).then(r => r.json())
	const resultHandler = r => {
		if (r.error) throw new Error(r.message)
		return r
	}
	const rpcCall = mode => o => doPost('/rpc/index.php')({ ...o, mode, tt: globalToken }).then(resultHandler)
	const save_illust_bookmark = rpcCall('save_illust_bookmark')
	const delete_illust_bookmark = rpcCall('delete_illust_bookmark')
	const doBookmark = id =>
		save_illust_bookmark({
			illust_id: id,
			restrict: 0,
			comment: '',
			tags: ''
		})
	const unBookmark = id => getData(id).then(d => delete_illust_bookmark({ bookmark_id: d.body.bookmarkData.id }))

	const bookmarked = new WeakMap()
	new MutationObserver(mut => {
		const el = $('figure>div>div>section>div>a[href*=bookmark_add]') || $('button.gtm-main-bookmark')
		if (el && !bookmarked.has(el)) {
			el.style.outline = 'none'
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
						.catch(e => alert(e.message))
				} else {
					unBookmark(new URLSearchParams(location.search).get('illust_id'))
						.then(r => {
							heart.style.fill = '#FFFFFF'
							border.style.fill = '#333'
							bookmarked.set(el, false)
						})
						.catch(e => alert(e.message))
				}
			})
		}
	}).observe(document.body, {
		childList: true,
		subtree: true
	})
})(globalInitData.token)
