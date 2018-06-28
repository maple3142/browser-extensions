// ==UserScript==
// @name         巴哈姆特動漫電玩通解答顯示小工具
// @namespace    https://blog.maple3142.net/
// @version      0.5
// @description  在巴哈姆特哈拉區右側的動漫電玩通顯示答案
// @author       maple3142
// @match        https://forum.gamer.com.tw/B.php*
// ==/UserScript==

;(function() {
	'use strict'

	const $ansbox = jQuery('.BH-rbox.BH-qabox1')

	const getCSRF = () => jQuery.ajax({ url: '/ajax/getCSRFToken.php', cache: false })
	const answer = sn => o =>
		getCSRF().then(token =>
			jQuery.get('/ajax/quiz_answer.php', { sn, o, token }).then(html => html.includes('答對了'))
		)
	const getAnswerOf = sn => Promise.all([1, 2, 3, 4].map(answer(sn))).then(r => r.indexOf(true) + 1)

	function getQuestion($ansbox) {
		let anss = $ansbox
			.find('li')
			.toArray()
			.map(x => x.textContent.trim())
		let q
		return (q = {
			question: $ansbox
				.contents()[0]
				.textContent.trim()
				.replace(/,/g, 'COMMA'),
			answer1: anss[0].replace(',', 'COMMA'),
			answer2: anss[1].replace(',', 'COMMA'),
			answer3: anss[2].replace(',', 'COMMA'),
			answer4: anss[3].replace(',', 'COMMA'),
			sn: $ansbox.data('quiz-sn'),
			toString: function() {
				return `${q.sn},${q.question},${q.answer1},${q.answer2},${q.answer3},${q.answer4},${q.answer}`
			}
		})
	}

	const APIURL = 'https://script.google.com/macros/s/AKfycbyDOc-c9K4PNYzm3S9qGy4nRnGcHDjDwzE_DV_xbNctKs42EO8/exec'
	function dbQuery(q) {
		return Promise.resolve(jQuery.get(APIURL)).then(data => {
			let p
			if (q.sn in data) p = data[q.sn]
			else
				p = getAnswerOf(q.sn).then(ans => {
					q.answer = ans
					console.log('Submit new question to database', q)
					jQuery.post(APIURL, { data: q.toString() })
					return ans
				})
			return p
		})
	}

	if (!egg.cookie.get('BAHAID')) return

	dbQuery(getQuestion($ansbox))
		.then(x => $ansbox.find('li')[x - 1])
		.then(el =>
			$(el)
				.css('font-size', '120%')
				.css('color', 'red')
		)
})()
