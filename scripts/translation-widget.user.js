// ==UserScript==
// @name         翻譯小工具
// @namespace    https://blog.maple3142.net/
// @version      1.4
// @description  選字時會出現小懸浮窗以方便翻譯
// @author       maple3142
// @include      *
// @connect      translate.google.com
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

// 此腳本的各版本作者為: 田雨菲->xinggsf->maple3142

'use strict'

const generateGoogleTTSLink = (() => {
	// Reference: https://stackoverflow.com/a/40078546/6885801
	function shiftLeftOrRightThenSumOrXor(num, opArray) {
		return opArray.reduce((acc, opString) => {
			var op1 = opString[1] //	'+' | '-' ~ SUM | XOR
			var op2 = opString[0] //	'+' | '^' ~ SLL | SRL
			var xd = opString[2] //	[0-9a-f]

			var shiftAmount = hexCharAsNumber(xd)
			var mask = op1 == '+' ? acc >>> shiftAmount : acc << shiftAmount
			return op2 == '+' ? (acc + mask) & 0xffffffff : acc ^ mask
		}, num)
	}

	function hexCharAsNumber(xd) {
		return xd >= 'a' ? xd.charCodeAt(0) - 87 : Number(xd)
	}

	function transformQuery(query) {
		for (var e = [], f = 0, g = 0; g < query.length; g++) {
			var l = query.charCodeAt(g)
			if (l < 128) {
				e[f++] = l //	0{l[6-0]}
			} else if (l < 2048) {
				e[f++] = (l >> 6) | 0xc0 //	110{l[10-6]}
				e[f++] = (l & 0x3f) | 0x80 //	10{l[5-0]}
			} else if (
				0xd800 == (l & 0xfc00) &&
				g + 1 < query.length &&
				0xdc00 == (query.charCodeAt(g + 1) & 0xfc00)
			) {
				//	that's pretty rare... (avoid ovf?)
				l =
					(1 << 16) +
					((l & 0x03ff) << 10) +
					(query.charCodeAt(++g) & 0x03ff)
				e[f++] = (l >> 18) | 0xf0 //	111100{l[9-8*]}
				e[f++] = ((l >> 12) & 0x3f) | 0x80 //	10{l[7*-2]}
				e[f++] = (l & 0x3f) | 0x80 //	10{(l+1)[5-0]}
			} else {
				e[f++] = (l >> 12) | 0xe0 //	1110{l[15-12]}
				e[f++] = ((l >> 6) & 0x3f) | 0x80 //	10{l[11-6]}
				e[f++] = (l & 0x3f) | 0x80 //	10{l[5-0]}
			}
		}
		return e
	}

	function normalizeHash(encondindRound2) {
		if (encondindRound2 < 0) {
			encondindRound2 = (encondindRound2 & 0x7fffffff) + 0x80000000
		}
		return encondindRound2 % 1e6
	}

	function calcHash(query, windowTkk) {
		//	STEP 1: spread the the query char codes on a byte-array, 1-3 bytes per char
		var bytesArray = transformQuery(query)

		//	STEP 2: starting with TKK index, add the array from last step one-by-one, and do 2 rounds of shift+add/xor
		var d = windowTkk.split('.')
		var tkkIndex = Number(d[0]) || 0
		var tkkKey = Number(d[1]) || 0

		var encondingRound1 = bytesArray.reduce((acc, current) => {
			acc += current
			return shiftLeftOrRightThenSumOrXor(acc, ['+-a', '^+6'])
		}, tkkIndex)

		//	STEP 3: apply 3 rounds of shift+add/xor and XOR with they TKK key
		var encondingRound2 =
			shiftLeftOrRightThenSumOrXor(encondingRound1, [
				'+-3',
				'^+b',
				'+-f'
			]) ^ tkkKey

		//	STEP 4: Normalize to 2s complement & format
		var normalizedResult = normalizeHash(encondingRound2)

		return normalizedResult.toString() + '.' + (normalizedResult ^ tkkIndex)
	}
	return function generateGoogleTTSLink(q, tl, tkk) {
		var tk = calcHash(q, tkk)
		return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
			q
		)}&tl=${tl}&total=1&idx=0&textlen=${
			q.length
		}&tk=${tk}&client=webapp&prev=input`
	}
})()
const googleUrl =
	'https://translate.google.com/translate_a/single?client=gtx&dt=t&dt=bd&dt=rm&dj=1&source=input&hl=en&sl=auto'
const reHZ = /^[\u4E00-\u9FA5\uFF00-\uFF20\u3000-\u301C]$/

const countOfWord = str => (str ? str.split(/\W+/).length : 0)
const isAllChinese = str => str.split('').every(ch => reHZ.test(ch))
const translateTip = {
	isOverTip(ev) {
		const el = ev.target
		return !!(this._tip && el && this._tip.contains(el))
	},
	show() {
		if (!this._tip) return
		this._tip.style.display = ''
	},
	hide() {
		if (!this._tip) return
		this._tip.style.display = 'none'
	},
	appendElement(el) {
		if (!this._tip) return
		this._tip_root.appendChild(el)
	},
	clear() {
		this._tip_root.innerHTML = ''
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
		// 最大寬度為 350px
		div.style.left =
			(ev.pageX + 350 <= document.body.clientWidth
				? ev.pageX
				: document.body.clientWidth - 350) + 'px'
		document.body.appendChild(div)
		this._tip = div
		this._tip_root = div.attachShadow({ mode: 'open' })
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
// 攔截 event 以防止選中的文字消失
icon.addEventListener('mousedown', e => e.preventDefault(), true)
icon.addEventListener('mouseup', e => e.preventDefault(), true)

document.addEventListener('mouseup', function (e) {
	// 若點擊的是翻譯面板，不用再出現 Google Translate Icon
	if (translateTip.isOverTip(e)) return
	const text = window.getSelection().toString().trim()
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
const clickIcon = function (e) {
	const text = window
		.getSelection()
		.toString()
		.trim()
		.replace(/\s{2,}/g, ' ')
	if (text) {
		icon.hidden = true
		translateTip.makeTip(e)
		const dest = isAllChinese(text) ? 'en' : navigator.language
		showTranslate(text, dest)
	}
}
icon.addEventListener('click', clickIcon, true)

icon.addEventListener(
	'mouseover',
	e => {
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
	e => {
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

function showTranslate(text, dest, originaldest = dest) {
	translateTip.hide()
	translateTip.clear()
	translate(text, dest)
		.then(res => {
			console.log(res)
			let html = ''
			for (const s of res.sentences) {
				if (s.trans) {
					html += s.trans + '</br>'
				} else if (s.src_translit && res.src === 'ja') {
					html += '<i>' + s.src_translit + '</i></br>'
				}
			}
			const translatedTexts = document.createElement('div')
			translatedTexts.innerHTML = html
			translatedTexts.style.fontSize = '14px'
			translateTip.appendElement(translatedTexts)

			// 如果翻譯目標不是英文，會在下方新增一個按鈕可在英文與原本的翻譯目標語言中切換
			// 若不是的話則把它隱藏(包括兩個 <a> 之間的空白)
			const a1 = document.createElement('a')
			a1.textContent = dest === 'en' ? '還原' : '翻譯為英文'
			a1.href = 'javascript:void(0)'
			a1.onclick = () =>
				showTranslate(
					text,
					dest === 'en' ? originaldest : 'en',
					originaldest
				)
			const a2 = document.createElement('a')
			a2.textContent = '在 Google 翻譯中檢視'
			a2.href = `https://translate.google.com/#${
				res.src
			}|${dest}|${encodeURIComponent(text)}`
			a2.target = '_blank'
			const linksWrapper = document.createElement('div')
			const a3 = document.createElement('a')
			a3.textContent = '播放語音'
			a3.href = 'javascript:void(0)'
			a3.onclick = async () => {
				const link = generateGoogleTTSLink(
					text,
					res.src,
					await getTKK()
				)
				const blob = await gmGetAsBlob(link)
				const url = URL.createObjectURL(blob)
				const aud = new Audio(url)
				aud.play()
				aud.onended = () => {
					URL.revokeObjectURL(url)
				}
			}

			if (originaldest !== 'en') {
				linksWrapper.appendChild(a1)
				linksWrapper.appendChild(document.createTextNode(' '))
			}
			linksWrapper.appendChild(a2)
			linksWrapper.appendChild(document.createTextNode(' '))
			linksWrapper.appendChild(a3)
			translateTip.appendElement(linksWrapper)

			translateTip.show()
		})
		.catch(err => {
			console.error(err)
			translateTip.appendElement(document.createTextNode('連接失敗'))
			const a2 = document.createElement('a')
			a2.textContent = '在 Google 翻譯中檢視'
			a2.href = `https://translate.google.com/#${
				res.src
			}|${dest}|${encodeURIComponent(text)}`
			a2.target = '_blank'
			translateTip.appendElement(a2)

			translateTip.show()
		})
}

function translate(text, dest) {
	const url = googleUrl + `&tl=${dest}&q=${encodeURIComponent(text)}`
	return new Promise((res, rej) => {
		GM_xmlhttpRequest({
			method: 'GET',
			responseType: 'json',
			url: url,
			onload: r => res(r.response),
			onerror: err => rej(err)
		})
	})
}

function getTKK(forceRefresh = false) {
	return new Promise((res, rej) => {
		let tkk = GM_getValue('tkk')
		if (!forceRefresh && tkk) {
			res(tkk)
		}
		GM_xmlhttpRequest({
			method: 'GET',
			responseType: 'text',
			url: 'https://translate.google.com/',
			onload: r => {
				const html = r.response
				const idx = html.indexOf('tkk')
				const tkk = html.slice(idx + 5, idx + 5 + 16)
				GM_setValue('tkk', tkk)
				res(tkk)
			},
			onerror: err => {
				if (!forceRefresh) rej(err)
				else res(getTKK(true))
			}
		})
	})
}

function gmGetAsBlob(url) {
	return new Promise((res, rej) => {
		GM_xmlhttpRequest({
			method: 'GET',
			responseType: 'blob',
			url: url,
			onload: r => res(r.response),
			onerror: err => rej(err)
		})
	})
}
