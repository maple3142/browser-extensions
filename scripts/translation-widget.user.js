// ==UserScript==
// @name         翻譯小工具
// @namespace    https://blog.maple3142.net/
// @version      1.0
// @description  選字時會出現小懸浮窗以方便翻譯
// @author       maple3142  xinggsf  田雨菲
// @include      *
// @connect      translate.google.com
// @grant        GM_xmlhttpRequest
// ==/UserScript==

'use strict'
const googleUrl = '//translate.google.com/translate_a/single?client=gtx&dt=t&dt=bd&dj=1&source=input&hl=en&sl=auto&tl='
const reHZ = /^[\u4E00-\u9FA5\uFF00-\uFF20\u3000-\u301C]$/

const countOfWord = str => (str ? str.split(/\W+/).length : 0)
const isAllChinese = str => str.split('').every(ch => reHZ.test(ch))
const translateTip = {
	isOverTip(ev) {
		const el = ev.target
		return !!(this._tip && el && this._tip.contains(el))
	},
	showText(text) {
		if (!this._tip) return
		this._tip.innerHTML = text
		this._tip.style.display = ''
	},
	destroy() {
		this._tip && this._tip.remove()
	},
	makeTip(ev) {
		this.destroy()
		const div = document.createElement('div')
		div.setAttribute(
			'style',
			`display:none !important;
position:absolute!important;
font-size:13px!important;
overflow:auto!important;
background:#fff!important;
font-family:sans-serif,Arial!important;
font-weight:normal!important;
text-align:left!important;
color:#000!important;
padding:0.5em 1em!important;
line-height:1.5em!important;
border-radius:5px!important;
border:1px solid #ccc!important;
box-shadow:4px 4px 8px #888!important;
max-width:350px!important;
max-height:216px!important;
z-index:2147483647!important;`
		)
		div.style.top = ev.pageY + 'px'
		//面板最大宽度为350px
		div.style.left =
			(ev.pageX + 350 <= document.body.clientWidth ? ev.pageX : document.body.clientWidth - 350) + 'px'
		document.body.appendChild(div)
		this._tip = div
	}
}
const icon = document.createElement('span')
icon.innerHTML = `<svg style="margin:4px !important;" "width="24" height="24" viewBox="0 0 768 768">
	<path d="M672 640.5v-417c0-18-13.5-31.5-31.5-31.5h-282l37.5 129h61.5v-33h34.5v33h115.5v33h-40.5c-10.5 40.5-33 79.5-61.5 112.5l87 85.5-22.5 24-87-85.5-28.5 28.5 25.5 88.5-64.5 64.5h225c18 0 31.5-13.5 31.5-31.5zM447 388.5c7.5 15 19.5 34.5 36 54 39-46.5 49.5-88.5 49.5-88.5h-127.5l10.5 34.5h31.5zM423 412.5l19.5 70.5 18-16.5c-15-16.5-27-34.5-37.5-54zM355.5 339c0-7.381-0.211-16.921-3-22.5h-126v49.5h70.5c-4.5 19.5-24 48-67.5 48-42 0-76.5-36-76.5-78s34.5-78 76.5-78c24 0 39 10.5 48 19.5l3 1.5 39-37.5-3-1.5c-24-22.5-54-34.5-87-34.5-72 0-130.5 58.5-130.5 130.5s58.5 130.5 130.5 130.5c73.5 0 126-52.5 126-127.5zM640.5 160.5c34.5 0 63 28.5 63 63v417c0 34.5-28.5 63-63 63h-256.5l-31.5-96h-225c-34.5 0-63-28.5-63-63v-417c0-34.5 28.5-63 63-63h192l28.5 96h292.5z" style="fill:#3e84f4;"></svg>`
icon.setAttribute(
	'style',
	`width:32px!important;
height:32px!important;
background:#fff!important;
border-radius:50%!important;
box-shadow:4px 4px 8px #888!important;
position:absolute!important;
z-index:2147483647!important;`
)

let outTimer, overTimer
document.documentElement.appendChild(icon)
icon.hidden = true
//攔截 event 以防止選中的文字消失
icon.addEventListener('mousedown', e => e.preventDefault(), true)
icon.addEventListener('mouseup', e => e.preventDefault(), true)

document.addEventListener('mouseup', function(e) {
	// 若點擊的是翻譯面板，不用再出現 Google Translate Icon
	if (translateTip.isOverTip(e)) return
	const text = window
		.getSelection()
		.toString()
		.trim()
	if (!text) {
		icon.hidden = true
		translateTip.destroy()
	} else if (icon.hidden) {
		icon.style.top = e.pageY + 12 + 'px'
		icon.style.left = e.pageX + 'px'
		icon.hidden = false
		outTimer = setTimeout(() => {
			icon.hidden = true
			outTimer = null
		}, 900)
	}
})
// Google Translate Icon 點擊事件
const clickIcon = function(e) {
	const text = window
		.getSelection()
		.toString()
		.trim()
		.replace(/\s{2,}/g, ' ')
	if (text) {
		icon.hidden = true
		translateTip.makeTip(e)
		const url = isAllChinese(text) ? googleUrl + 'en&q=' : googleUrl + navigator.language + '&q='
		ajax(url, text)
	}
}
icon.addEventListener('click', clickIcon, true)

icon.addEventListener(
	'mouseover',
	function(e) {
		if (outTimer) {
			clearTimeout(outTimer)
			outTimer = null
		}

		overTimer = overTimer || setTimeout(clickIcon, 360, e)
	},
	true
)
icon.addEventListener(
	'mouseout',
	function(e) {
		if (overTimer) {
			clearTimeout(overTimer)
			overTimer = null
		}

		outTimer =
			outTimer ||
			setTimeout(() => {
				icon.hidden = true
				outTimer = null
			}, 360)
	},
	true
)

function ajax(url, text) {
	url += encodeURIComponent(text)
	GM_xmlhttpRequest({
		method: 'GET',
		responseType: 'json',
		url: url,
		onload: function(res) {
			google(res.response)
		},
		onerror: function(res) {
			translateTip.showText('連接失敗\nURL: ' + url)
		}
	})
}

function google(rst) {
	let k,
		html = ''
	for (k of rst.sentences) html += k.trans
	translateTip.showText(html)
}
