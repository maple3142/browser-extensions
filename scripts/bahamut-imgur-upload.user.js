// ==UserScript==
// @name         Baha imgur upload
// @namespace    https://blog.maple3142.net/
// @version      0.6.0
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

    const debounce = delay => fn => {
        let de = false
        return (...args) => {
            if (de) return
            de = true
            fn(...args)
            setTimeout(() => (de = false), delay)
        }
    }
    if (location.hostname === 'blog.maple3142.net') {
        const access_token = /access_token=(.*?)&/.exec(location.hash)[1]
        if (access_token) {
            GM_setValue('access_token', access_token)
        }
    } else {
        const observer = new MutationObserver(debounce(10)(_ => {
            if ($('.tab-menu__item1.active').css('display') === 'block') { // 上傳圖片 tab1 打開了
                if ($('#imgur_uplbtn').length) return //exists, ignore it
                const $uplbtn=$('<button>').addClass('btn').addClass('btn-insert').addClass('btn-primary').addClass('is-disabled').attr('id','imgur_uplbtn').text('上傳到 imgur')
                const $uplfile=$('input[name=upic1]')
                const $cancelbtn=$('.dialogify .btn:contains(取消)')
                $('.dialogify .btn.btn-insert.btn-primary').before($uplbtn)
                $uplfile.on('change',e=>{
                    if(e.target.files[0])$uplbtn.removeClass('is-disabled')
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
                    readbase64(file).then(image => {
                        $uplbtn.text('上傳中...').addClass('is-disabled')
                        return upload(image.split('base64,')[1])
                    })
                        .then(r => {
                        const url=r.data.link
                        if (unsafeWindow.bahaRte != null) {
                            //full rte editor
                            bahaRte.toolbar.insertUploadedImage(url)
                        } else if ($('#balaTextId').length) {
                            //guild/bala reply
                            const id = $('#balaTextId').html()
                            const $tx = $('#' + id)
                            $tx.val($tx.val() + url)
                        } else if ($('#msgtalk').length) {
                            //guild/bala new
                            const $msgtalk = $('#msgtalk')
                            $msgtalk.val($msgtalk.val() + urlk)
                        }
                        else if(typeof Forum!=='undefined'&&typeof Forum.C!=='undefined'&&typeof Forum.C.quills!=='undefined'){
                            const q=Forum.C.quills[0]
                            const {index}=q.getSelection()||{}
                            q.insertEmbed(index||0,'image',url)
                        }
                        else {
                            //others
                            prompt('暫時還不支援這種編輯器，不過可以複製下方的網址來貼上', url)
                        }
                        $cancelbtn.click()
                    }).catch(e=>{
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
                const $urlinput=$('#insertImageUrl')
                const $cvtbutton=$('<button>').attr('id','imgur_urlcvt').addClass('btn').addClass('btn-primary').text('轉換為 imgur 網址')
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
                    $cvtbutton
                        .text('圖片上傳中, 請稍候...')
                        .show()
                    upload(url).then(r => {
                        $urlinput.val(r.data.link)
                        $cvtbutton.text('轉換為 imgur 網址')
                    }).catch(e=>{
                        console.error(e)
                        alert('上傳失敗')
                        $cvtbutton.text('轉換為 imgur 網址')
                    })
                })
            } else {
                $('#bahaimgur_cvt').remove()
            }
        }))
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
        }).then(r=>{
            if(!r.success)throw new Error(r)
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
