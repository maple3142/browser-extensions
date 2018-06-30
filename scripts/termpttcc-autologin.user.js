// ==UserScript==
// @name         term.ptt.cc 自動登入
// @namespace    https://blog.maple3142.net/
// @version      0.2.4
// @description  自動登入 term.ptt.cc + 自動跳過一些畫面
// @author       maple3142
// @match        https://term.ptt.cc/
// @run-at       document-start
// @grant        unsafeWindow
// @grant        window.close
// ==/UserScript==

const ID = ''
const PASS = ''
const skiplist = [
	{ re: /歡迎您再度拜訪，上次您是從.*連往本站。/, input: '\n' }, //跳過啟動頁 1
	{ re: /單一小時上線人次.*單日上線人次/, input: 'q' }, // 跳過啟動頁 2
	{ re: /您想刪除其他重複登入的連線嗎？\[Y\/n\]/, input: 'y\n' }, // 自動刪除重複登入
	{ re: /上方為使用者心情點播留言區，不代表本站立場/, input: 'f\n' } // 自動進入我的最愛(第一次)
]
const closeOnQuit = true
const closeWarning = true
;(function() {
	'use strict'
	// event
	const E = {
		callbacks: {},
		on(evt, cb) {
			if (!Array.isArray(this.callbacks[evt])) this.callbacks[evt] = []
			this.callbacks[evt].push(cb)
		},
		emit(evt, ...args) {
			if (!Array.isArray(this.callbacks[evt])) return
			this.callbacks[evt].forEach(cb => cb(...args))
		},
		off(evt, cb) {
			if (!cb) this.callbacks[evt] = []
			else this.callbacks = this.callbacks.filter(x => x !== cb)
		}
	}

	// helpers
	const insertText = (() => {
		let t = document.querySelector('#t')
		return str => {
			if (!t) t = document.querySelector('#t')
			const e = new CustomEvent('paste')
			e.clipboardData = { getData: () => str }
			t.dispatchEvent(e)
		}
	})()
	function hook(obj, key, cb) {
		const fn = obj[key].bind(obj)
		obj[key] = function(...args) {
			fn.apply(this, args)
			cb.apply(this, args)
		}
	}

	// console hook
	hook(unsafeWindow.console, 'info', t => {
		if (typeof t !== 'string' || !/pttchrome (\w+)/.test(t)) return
		const evt = /pttchrome (\w+)/.exec(t.trim())[1]
		E.emit(evt.replace(/^on/, '').toLowerCase())
	})
	hook(unsafeWindow.console, 'log', t => {
		if (t === 'view update') E.emit('update')
	})

	// main
	E.on('connect', () => insertText(ID + '\n' + PASS + '\n'))
	E.on('update', () => {
		const t = Array.prototype.map.call(document.querySelectorAll('span[type=bbsRow]'), x => x.textContent).join('')
		const ar = skiplist.filter(x => x.re.test(t))
		for (let i = 0; i < ar.length; i++) {
			if (ar[i].executed) continue
			insertText(ar[i].input)
			ar[i].executed = true
		}
		if (skiplist.filter(x => x.executed).length === skiplist.length) E.off('update')
	})
	if (closeOnQuit) E.on('close', close)

	// I don't know why closing warning vanished after I override WebSocket...
	// Don't ask me how did that happened, it is a magic.
	const _WebSocket = WebSocket
	const XWebSocket = function(...args) {
		const instance = new WebSocket(...args)
		XWebSocket.instances.push(instance)
		instance._close = instance.close
		instance.close = (...args) => {
			XWebSocket.instances = XWebSocket.instances.filter(x => x !== instance)
			instance._close(...args)
		}
		return instance
	}
	XWebSocket.instances = []
	unsafeWindow.WebSocket = XWebSocket
	unsafeWindow.onload = () =>
		unsafeWindow.addEventListener('beforeunload', () => {
			XWebSocket.instances[0] ? XWebSocket.instances[0].close() : null
			return closeWarning ? 'c8763' : null
		})
})()
