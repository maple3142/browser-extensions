// ==UserScript==
// @name         巴哈姆特公會批量簽到
// @namespace    https://blog.maple3142.net/
// @version      0.2.1
// @description  巴哈姆特公會批量簽到工具
// @author       maple3142
// @match        https://home.gamer.com.tw/joinGuild.php?owner=*
// @match        https://guild.gamer.com.tw/?sign=1
// @grant        GM_getValue
// @grant        GM_setValue
// @compatible   firefox >=52
// @compatible   chrome >=55
// ==/UserScript==

/*
 * 使用教學
 * 安裝此腳本，然後到你的小屋點擊"公會社團"，然後會詢問是否要批量簽到時按確定就好了
*/
;(function() {
	'use strict'
	function signin(sn) {
		return fetch('https://guild.gamer.com.tw/ajax/guildSign.php', {
			method: 'post',
			body: 'sn=' + sn,
			credentials: 'include',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		})
			.then(r => r.json())
			.catch(e => {})
	}
	if (location.hostname === 'home.gamer.com.tw') {
		const id = location.href.match(/owner=([\w\d]*)/)[1]
		if (id !== BAHAID) return
		if (!confirm('要批量簽到嗎?')) return
		const list = jQuery('.acgboximg.BC5')
			.toArray()
			.map(
				el =>
					$(el)
						.find('a')
						.attr('href')
						.match(/sn=(\d*)/)[1]
			)
		if (!list.length) return
		GM_setValue('list', list)
		open('https://guild.gamer.com.tw/?sign=1', 'window', 'width=500,height=300')
	}
	if (location.hostname === 'guild.gamer.com.tw') {
		document.write('')
		let list = GM_getValue('list')
		if (!list) return
		Promise.all(list.map(sn => signin(sn))).then(results => {
			const okcnt = results.filter(r => r && r.ok).length
			alert(`簽到了${okcnt}個公會`)
			GM_setValue('list', false)
			close()
		})
	}
})()
