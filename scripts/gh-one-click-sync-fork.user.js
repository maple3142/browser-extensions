// ==UserScript==
// @name         GitHub one-click sync fork
// @namespace    https://blog.maple3142.net/
// @version      0.1
// @description  Sync your GitHub fork repo within one click
// @author       maple3142
// @include      /^https:\/\/github\.com/[A-Za-z0-9-]+\/[^\/]+/
// @require      https://unpkg.com/xfetch-js@0.2.3/xfetch.min.js
// @grant        GM_setValue
// @grant        GM_getValue
// @compatible   firefox >=52
// @compatible   chrome >=55
// ==/UserScript==

;(function() {
	'use strict'
	const $ = s => document.querySelector(s)
	const $$ = s => [...document.querySelectorAll(s)]
	const gh = xf.extend({ baseURI: 'https://api.github.com/' })
	const oauthurl = // eslint-disable-next-line max-len
		'https://github.com/login/oauth/authorize?client_id=5c0954a832a0f2bb68f2&scope=repo&redirect_uri=https://github.com/'
	const confirmmsg = // eslint-disable-next-line max-len
		'Are you sure?\nIt will replace all changes you have made with upstream\'s content.\nIT CANNOT BE RECOVERED!'
	const search = new URL(location.href).searchParams
	if (search.has('code')) {
		const code = search.get('code')
		xf.post('https://github.com/login/oauth/access_token', {
			json: { client_id: '5c0954a832a0f2bb68f2', client_secret: '799a5a49ef0ebde906f8bedc2e3327a99cd0d92a', code }
		}).text(str => {
			const search = new URLSearchParams(str)
			GM_setValue('token', search.get('access_token'))
			window.close()
		})
	}

	const addBtn = () => {
		const currentUser = $('.user-profile-link>strong').textContent
		const currentRepoOwner = location.pathname.split('/')[1]
		const isUserMatch = currentUser === currentRepoOwner
		const isFork = !!$('.fork-flag')

		if (!isUserMatch || !isFork) return
		$$('.one-click-sync-fork').forEach(btn => btn.remove())
		const repo = location.pathname
			.split('/')
			.slice(1, 3)
			.join('/')
		const upstream = $('.fork-flag a')
			.getAttribute('href')
			.slice(1)
		const branchbtn = $('.file-navigation>div.select-menu')
		if (!branchbtn) return
		const branch = branchbtn.querySelector('button').title || branchbtn.querySelector('button>span').textContent
		const el = document.createElement('div')
		el.classList.add('one-click-sync-fork')
		el.classList.add('btn')
		el.classList.add('btn-sm')
		el.classList.add('btn-primary')
		el.textContent = `Update fork from ${upstream}/${branch}`
		el.onclick = async () => {
			const token = GM_getValue('token')
			if (!token) {
				window.open(oauthurl, '_target')
				return
			}
			if (!confirm(confirmmsg)) return
			const sha = await gh.get(`/repos/${upstream}/commits`).json(c => c[0].sha)
			await gh
				.patch(`/repos/${repo}/git/refs/heads/${branch}`, {
					headers: { Authorization: `token ${token}` },
					json: { sha, force: true }
				})
				.json()
			location.reload()
		}
		branchbtn.insertAdjacentElement('afterend', el)
	}
	addBtn()
	new MutationObserver(addBtn).observe(document.body, { childList: true })
})()
