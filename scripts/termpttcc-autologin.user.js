// ==UserScript==
// @name         term.ptt.cc 自動登入
// @namespace    https://blog.maple3142.net/
// @version      0.4.0
// @description  自動登入 term.ptt.cc + 自動跳過一些畫面
// @author       maple3142
// @match        https://term.ptt.cc/
// @run-at       document-start
// @grant        unsafeWindow
// @grant        window.close
// @license      MIT
// ==/UserScript==

const skiplist = [
	{ re: /歡迎您再度拜訪，上次您是從.*連往本站。.*請按任意鍵繼續/, input: '\n' }, //跳過啟動頁 1
	{ re: /單一小時上線人次.*單日上線人次/, input: 'q' }, // 跳過啟動頁 2
	{ re: /您想刪除其他重複登入的連線嗎？\[Y\/n\]/, input: 'y\n' }, // 自動刪除重複登入
	{ re: /上方為使用者心情點播留言區，不代表本站立場/, input: 'f\n' } // 自動進入我的最愛(第一次)
]
const closeOnQuit = true // 手動從 ptt 選擇離開 or 斷線時自動關閉頁面
;(() => {
	'use strict'
	const onApp = app => {
		// helpers
		const insertText = str => app.send(str.replace('\n', '\r'))

		function getScreenText(app) {
			const { buf } = app
			return Array.from({ length: buf.rows }, (_, row) => buf.getRowText(row, 0, buf.cols)).join('')
		}

		const KEY = 'ptt-credentials'
		const loginAssist = app.getPlugin('login_assist')

		// hook loginAssist.handleLogin to store credentials
		const origLogin = loginAssist.handleLogin
		loginAssist.handleLogin = credentials => {
			console.log(credentials)
			const { username, password } = credentials
			if (username && password) {
				localStorage.setItem(KEY, JSON.stringify({ username, password }))
			}
			return origLogin(credentials)
		}

		// the terminal will detect login automatically, try it if login credentials are stored and not yet attempted
		let autoLoginAttempted = false
		app.on('term:login-prompt', () => {
			if (autoLoginAttempted) return

			if (!(KEY in localStorage)) return
			const credentials = JSON.parse(localStorage.getItem(KEY))
			if (!credentials?.username || !credentials?.password) return

			autoLoginAttempted = true
			loginAssist.handleLogin(credentials)
		})
		// to skip some screens
		app.on('term:screen-update', () => {
			if (skiplist.every(x => x.executed)) return // skip regex matching if all executed
			const t = getScreenText(app)
			if (/請輸入代號，或以 guest 參觀，或以 new 註冊:.*(請重新輸入。|密碼不對或無此帳號)/.test(t)) {
				// stored password is probably wrong, clear it and refresh
				localStorage.removeItem(KEY)
				location.reload()
			}
			const rule = skiplist.find(rule => !rule.executed && rule.re.test(t))
			if (!rule) return
			console.log('executeed', rule, t)
			rule.executed = true
			insertText(rule.input)
		})
		// close the page when disconnected
		if (closeOnQuit) app.on('term:disconnect', close)

		// add a notice about storing credentials in localStorage
		const seen = new WeakSet()
		const addNotice = () => {
			document.querySelectorAll('p.LoginModal__Hint').forEach(hint => {
				if (seen.has(hint)) return
				seen.add(hint)
				hint.append(
					document.createElement('br'),
					'term.ptt.cc 自動登入腳本會將帳密儲存於 localStorage 本機儲存空間，以供下次自動登入。密碼未加密，請勿在共用電腦使用。'
				)
			})
		}
		new MutationObserver(addNotice).observe(document.body, {
			childList: true,
			subtree: true
		})
	}
	let app = null
	Object.defineProperty(unsafeWindow, 'app', {
		set(x) {
			if (!app) onApp(x)
			app = x
		},
		get: () => app
	})
})()
