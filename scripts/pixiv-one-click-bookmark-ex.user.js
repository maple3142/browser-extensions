// ==UserScript==
// @name         Pixiv 一鍵收藏 EX
// @namespace    https://blog.maple3142.net/
// @version      0.4.3
// @description  強化版的 pixiv 一鍵收藏，支援收藏與取消
// @author       maple3142
// @match        https://www.pixiv.net/member_illust.php?mode=medium&illust_id=*
// @require      https://unpkg.com/xfetch-js@0.1.6/xfetch.min.js
// @grant        none
// @compatible   firefox >=52
// @compatible   chrome >=55
// ==/UserScript==

;(function(globalToken) {
	'use strict'
	const $ = (s, el = document) => el.querySelector(s)
	const $$ = (s, el = document) => [...el.querySelectorAll(s)]
	const resultHandler = r => {
		if (r.error) throw new Error(r.message)
		return r
	}
	const rpcBind = mode => o =>
		xf.post('/rpc/index.php', { form: { ...o, mode, tt: globalToken } }).then(resultHandler)
	const save_illust_bookmark = rpcBind('save_illust_bookmark')
	const delete_illust_bookmark = rpcBind('delete_illust_bookmark')
	const doBookmark = id =>
		save_illust_bookmark({
			illust_id: id,
			restrict: 0,
			comment: '',
			tags: ''
		})
	const unBookmark = id =>
		xf
			.get(`https://www.pixiv.net/ajax/illust/${id}/bookmarkData`)
			.json(d => delete_illust_bookmark({ bookmark_id: d.body.bookmarkData.id }))

	const bookmarked = new WeakMap()
	new MutationObserver(mut => {
		const el = $('div[role=presentation]+div a[href*=bookmark_add]') || $('.gtm-main-bookmark')
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
