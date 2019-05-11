// ==UserScript==
// @name         Baha imgur upload
// @namespace    https://blog.maple3142.net/
// @version      0.7.2
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
	const qs = o =>
		Object.keys(o)
			.map(k => k + '=' + encodeURIComponent(o[k]))
			.join('&')
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
			$msgtalk.val($msgtalk.val() + url)
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
		if (typeof Dropzone !== 'undefined') {
			// hook dropzone instances
			Dropzone.instances = []
			const _Dropzone = Dropzone
			const Dropzone$ = function(...o) {
				const i = new _Dropzone(...o)
				_Dropzone.instances.push(i)
				return i
			}
			unsafeWindow.Dropzone = Object.assign(Dropzone$, _Dropzone)
		}
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
						.addClass('unchecked')
						.attr('id', 'imgur_uplbtn')
						.text('imgur 模式: 停用')
					const $cancelbtn = $('.dialogify .btn:contains(取消)')
					$('.dialogify .btn.btn-insert.btn-primary').before($uplbtn)
					$uplbtn.on('click', e => {
						e.preventDefault()
						e.stopPropagation()
						if (!chk_isAuthorized()) {
							login()
							return
						}
						imgurEnable = !imgurEnable
						if (imgurEnable) $uplbtn.removeClass('unchecked').text('imgur 模式: 啟用')
						else $uplbtn.addClass('unchecked').text('imgur 模式: 停用')
					})
					// Dropzone handling
					let imgurEnable = false
					const dz = Dropzone.instances[Dropzone.instances.length - 1]
					if (dz.hooked) return
					dz.hooked = true
					dz.on('sending', (e, xhr, fd) => {
						if (imgurEnable) dzupload(xhr)
					})
					const originalcb = dz._callbacks.success[1]
					dz._callbacks.success[1] = (file, r) => {
						console.log(r)
						originalcb.apply(dz, [file, Array.isArray(r) ? r : [r.data.link]])
					}

					document.onpaste = e => {
						const { items } = e.clipboardData
						for (let i = 0; i < items.length; i++) {
							// It doesn't have iterator protocol...
							const item = items[i]
							if (item.kind === 'file') {
								dz.addFile(item.getAsFile())
							}
						}
					}
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
						$uplbtn.text('上傳中...')
						upload(file)
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
	function getInitialUploadData() {
		const data = new FormData()
		if (ALBUM_TO_UPLOAD) {
			data.append('album', ALBUM_TO_UPLOAD)
		}
		return data
	}
	function upload(image) {
		const data = getInitialUploadData()
		data.append('image', image)
		return $.ajax({
			type: 'POST',
			url: 'https://api.imgur.com/3/image',
			data,
			processData: false,
			contentType: false,
			headers: {
				Authorization: `Bearer ${GM_getValue('access_token')}`
			},
			dataType: 'json'
		}).then(r => {
			if (!r.success) throw new Error(r)
			return r
		})
	}
	function dzupload(xhr) {
		const data = getInitialUploadData()
		const fd$ = new Promise(res => {
			xhr._send = xhr.send
			xhr.send = res
		})
		return fd$.then(fd => {
			xhr.open('POST', 'https://api.imgur.com/3/image')
			xhr.setRequestHeader('Authorization', `Bearer ${GM_getValue('access_token')}`)
			data.append('image', fd.get('dzfile'))
			xhr._send(data)
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
	const css = document.createElement('style')
	css.textContent = `.btn.unchecked{box-shadow: inset 0 1px 1px rgba(0,0,0,0.2);opacity:0.5;}`
	document.body.appendChild(css)
})(jQuery)
