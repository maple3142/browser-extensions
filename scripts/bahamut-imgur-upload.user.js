// ==UserScript==
// @name         Baha imgur upload
// @namespace    https://blog.maple3142.net/
// @version      0.5
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

	if (location.hostname === 'blog.maple3142.net') {
		const access_token = /access_token=(.*?)&/.exec(location.hash)[1]
		if (access_token) {
			GM_setValue('access_token', access_token)
		}
	} else {
		const observer = new MutationObserver(_ => {
			const $origUpl = $('#bhImgModeUpload')
			if ($origUpl.css('display') === 'block') {
				if ($('#imgurupl').length) return //exists, ignore it
				$origUpl.after(`
<div id="bahaimgur">
<input type="file" accept="image/*" id="imgurupl">
<button id="imguruplbtn">上傳imgur</button>
</div>
`)
				$('#imguruplbtn').on('click', e => {
					e.preventDefault()
					e.stopPropagation()
					if (!chk_isAuthorized()) {
						login()
						return
					}
					const file = $('#imgurupl')[0].files[0]
					if (!file) return //no file

					readbase64(file)
						.then(image => {
							$('#bahaimgur').hide(),
								$('#bhImgMsg')
									.html('圖片上傳中, 請稍候...')
									.show(),
								$('#bhImgModeUpload').hide()
							return upload(image.split('base64,')[1])
						})
						.then(r => {
							if (!r.success) {
								alert('上傳失敗')
								egg.lightbox.close()
								return
							}
							if (unsafeWindow.bahaRte != null) {
								//full editor
								bahaRte.toolbar.insertUploadedImage(r.data.link)
							} else if ($('#balaTextId').length) {
								//guild/bala reply
								const id = $('#balaTextId').html()
								const $tx = $('#' + id)
								$tx.val($tx.val() + r.data.link)
								egg.lightbox.close()
							} else if ($('#msgtalk').length) {
								//guild/bala new
								egg.lightbox.close()
								const $msgtalk = $('#msgtalk')
								$msgtalk.val($msgtalk.val() + r.data.link)
							} else {
								//others
								prompt('暫時還不支援這種編輯器，不過可以複製下方的網址來貼上', r.data.link)
								$('#bhImgMsg').hide()
								$('#bhImgModeUpload').show()
								$('#bahaimgur').show()
							}
						})
				})
			} else {
				$('#bahaimgur').remove()
			}

			const $origUrlinput = $('#bhImgModeInsertUrl')
			if ($origUrlinput.css('display') === 'block') {
				if ($('#bahaimgur_cvt').length) return
				$('#bhImgImageUrl').after(`<button id="bahaimgur_cvt">轉換成imgur網址</button>`)

				$('#bahaimgur_cvt').on('click', e => {
					e.preventDefault()

					if (!chk_isAuthorized()) {
						login()
						return
					}
					const url = $('#bhImgImageUrl').val()
					if (!url) {
						alert('請輸入網址')
						return
					}
					$('#bhImgMsg')
						.html('圖片上傳中, 請稍候...')
						.show()
					upload(url).then(r => {
						if (!r.success) {
							alert('上傳失敗')
							egg.lightbox.close()
							return
						}
						$('#bhImgImageUrl').val(r.data.link)
						$('#bhImgMsg').hide()
					})
				})
			} else {
				$('#bahaimgur_cvt').remove()
			}
		})
		observer.observe(document.body, { attributes: true, childList: true, characterData: true, subtree: true })
	}
	function upload(image) {
		return $
			.ajax({
				type: 'POST',
				url: 'https://api.imgur.com/3/image',
				data: { image },
				headers: {
					Authorization: `Bearer ${GM_getValue('access_token')}`
				},
				dataType: 'json'
			})
			.catch(e => {
				console.error(e)
				alert('上傳失敗')
				egg.lightbox.close()
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
