// ==UserScript==
// @name         Baha imgur upload
// @namespace    https://blog.maple3142.net/
// @version      0.6.3
// @description  add upload to imgur in bahamut
// @author       maple3142
// @match        https://*.gamer.com.tw/*
// @match        https://blog.maple3142.net/bahamut-imgur-upload.html
// @require      https://code.jquery.com/jquery-3.2.1.min.js
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

;(function($) {
	'use strict'
	/*
	 * ALBUM_TO_UPLOAD 是你想要上傳的目標相簿 id
	 * 例如相簿 https://imgur.com/a/C8763 的 id 是 C8763
	 * 請把他貼到 GM_getValue('ALBUM_TO_UPLOAD','') 後面的引號中，變成 GM_getValue('ALBUM_TO_UPLOAD','C8763')
	 * 這樣可以確保 id 不會在腳本更新後被清除，不過如果要修改的需要自己去腳本管理器的儲存空間修改
	 * Tampermonkey 直接在編輯頁面上面的 Storage 頁面修改就好，其他我就不知道了
	*/
	const ALBUM_TO_UPLOAD = GM_getValue('ALBUM_TO_UPLOAD', '')
	if (ALBUM_TO_UPLOAD) GM_setValue('ALBUM_TO_UPLOAD', ALBUM_TO_UPLOAD)

	const debounce = delay => fn => {
		let de = false
		return (...args) => {
			if (de) return
			de = true
			fn(...args)
			setTimeout(() => (de = false), delay)
		}
	}
	const insertToRte = c => {
		// copy from utility_fx.js
		let a
		a = bahaRte.win.getSelection()
		a.getRangeAt &&
			a.rangeCount &&
			((a = a.getRangeAt(0)), a.deleteContents(), (c = a.createContextualFragment(c)), a.insertNode(c))
	}
	const insertUrlToField = url => {
		if (unsafeWindow.bahaRte != null) {
			// full rte editor
			const ht = $('<div>')
				.append($('<img>').attr('src', url))
				.html()
			insertToRte(ht)
		} else if ($('#balaTextId').length) {
			// guild/bala reply
			const id = $('#balaTextId')
				.html()
				.trim()
			const $tx = $('#' + id)
			$tx.val($tx.val() + url)
		} else if ($('#msgtalk').length) {
			// guild/bala new
			const $msgtalk = $('#msgtalk')
			$msgtalk.val($msgtalk.val() + urlk)
		} else if (
			typeof Forum !== 'undefined' &&
			typeof Forum.C !== 'undefined' &&
			typeof Forum.C.quills !== 'undefined'
		) {
			// quick reply
			const q = Forum.C.quills[0]
			const { index } = q.getSelection() || {}
			q.insertEmbed(index || 0, 'image', url)
		} else {
			//others
			prompt('暫時還不支援這種編輯器，不過可以複製下方的網址來貼上', url)
		}
	}
	unsafeWindow.balaInsertImage = () => (insertUrlToField($('#bhImgImageUrl').val()), egg.lightbox.close()) // polyfill original buggy image insert
	const isOldImgBoxChecked = i => $(`input[name=bhImgMode][value=${i}]`).prop('checked')
	if (location.hostname === 'blog.maple3142.net') {
		const access_token = /access_token=(.*?)&/.exec(location.hash)[1]
		if (access_token) {
			GM_setValue('access_token', access_token)
		}
	} else {
		const observer = new MutationObserver(
			debounce(10)(_ => {
				// new image box
				if ($('.tab-menu__item1.active').css('display') === 'block') {
					// 上傳圖片 tab1 打開了
					if ($('#imgur_uplbtn').length) return // ignore it if exists
					const $uplbtn = $('<button>')
						.addClass('btn')
						.addClass('btn-insert')
						.addClass('btn-primary')
						.addClass('is-disabled')
						.attr('id', 'imgur_uplbtn')
						.text('上傳到 imgur')
					const $uplfile = $('input[name=upic1]')
					const $cancelbtn = $('.dialogify .btn:contains(取消)')
					$('.dialogify .btn.btn-insert.btn-primary').before($uplbtn)
					$uplfile.on('change', e => {
						if (e.target.files[0]) $uplbtn.removeClass('is-disabled')
					})
					$uplbtn.on('click', e => {
						e.preventDefault()
						e.stopPropagation()
						if (!chk_isAuthorized()) {
							login()
							return
						}
						const file = $uplfile[0].files[0]
						if (!file) return //no file
						readbase64(file)
							.then(image => {
								$uplbtn.text('上傳中...').addClass('is-disabled')
								return upload(image.split('base64,')[1])
							})
							.then(r => {
								insertUrlToField(r.data.link)
								$cancelbtn.click()
							})
							.catch(e => {
								console.error(e)
								alert('上傳失敗')
								$cancelbtn.click()
							})
					})
				} else {
					$('#imgur_uplbtn').remove()
				}

				if ($('.tab-menu__item3.active').css('display') === 'block') {
					if ($('#imgur_urlcvt').length) return
					const $urlinput = $('#insertImageUrl')
					const $cvtbutton = $('<button>')
						.attr('id', 'imgur_urlcvt')
						.addClass('btn')
						.addClass('btn-primary')
						.text('轉換為 imgur 網址')
					$urlinput.after($cvtbutton)

					$cvtbutton.on('click', e => {
						e.preventDefault()
						if (!chk_isAuthorized()) {
							login()
							return
						}
						const url = $urlinput.val()
						if (!url) {
							alert('請輸入網址')
							return
						}
						$cvtbutton.text('圖片上傳中, 請稍候...').show()
						upload(url)
							.then(r => {
								$urlinput.val(r.data.link)
								$cvtbutton.text('轉換為 imgur 網址')
							})
							.catch(e => {
								console.error(e)
								alert('上傳失敗')
								$cvtbutton.text('轉換為 imgur 網址')
							})
					})
				} else {
					$('#bahaimgur_cvt').remove()
				}

				// old image box
				if (isOldImgBoxChecked(1) && !$('#imgurold_upl').length) {
					const $uplbtn = $('<button>')
						.text('上傳 imgur')
						.css('margin-left', '3px')
					const $uplfile = $('<input>')
						.attr('type', 'file')
						.width(220)
					const $wrap = $('<div>').attr('id', 'imgurold_upl')
					$('#bhImgModeUpload').append($wrap.append($uplfile).append($uplbtn))
					$uplbtn.on('click', e => {
						e.preventDefault()
						e.stopPropagation()
						if (!chk_isAuthorized()) {
							login()
							return
						}
						const file = $uplfile[0].files[0]
						if (!file) return //no file
						readbase64(file)
							.then(image => {
								$uplbtn.text('上傳中...')
								return upload(image.split('base64,')[1])
							})
							.then(r => {
								insertUrlToField(r.data.link)
								egg.lightbox.close()
							})
							.catch(e => {
								console.error(e)
								alert('上傳失敗')
								egg.lightbox.close()
							})
					})
				} else if (isOldImgBoxChecked(3) && !$('#imgurold_cvt').length) {
					const $urlinput = $('#bhImgImageUrl')
					const $cvtbutton = $('<button>')
						.text('轉換為 imgur 網址')
						.css('display', 'block')
						.attr('id', 'imgurold_cvt')
					$urlinput
						.after($cvtbutton)
						.parent()
						.css('display', 'flex')
						.css('flex-direction', 'column')
						.css('align-items', 'center')

					$cvtbutton.on('click', e => {
						e.preventDefault()
						if (!chk_isAuthorized()) {
							login()
							return
						}
						const url = $urlinput.val()
						if (!url) {
							alert('請輸入網址')
							return
						}
						$cvtbutton.text('圖片上傳中, 請稍候...').show()
						upload(url)
							.then(r => {
								$urlinput.val(r.data.link)
								$cvtbutton.text('轉換為 imgur 網址')
							})
							.catch(e => {
								console.error(e)
								alert('上傳失敗')
								$cvtbutton.text('轉換為 imgur 網址')
							})
					})
				}
			})
		)
		observer.observe(document.body, { attributes: true, childList: true, characterData: true, subtree: true })
	}
	function upload(image) {
		const data = { image }
		if (ALBUM_TO_UPLOAD) {
			data.album = ALBUM_TO_UPLOAD
		}
		return $
			.ajax({
				type: 'POST',
				url: 'https://api.imgur.com/3/image',
				data,
				headers: {
					Authorization: `Bearer ${GM_getValue('access_token')}`
				},
				dataType: 'json'
			})
			.then(r => {
				if (!r.success) throw new Error(r)
				return r
			})
	}
	function chk_isAuthorized() {
		return GM_getValue('access_token', null) !== null
	}
	function login() {
		window.open(
			'https://api.imgur.com/oauth2/authorize?client_id=41e93183c27ec0e&response_type=token',
			'oauth',
			'height=700,width=700'
		)
	}
	function readbase64(file) {
		return new Promise((res, rej) => {
			const reader = new FileReader()
			reader.onload = e => res(e.target.result)
			reader.onerror = err => rej(err)
			reader.readAsDataURL(file)
		})
	}
})(jQuery.noConflict())
