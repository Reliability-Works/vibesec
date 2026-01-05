export const nextRulesFixture = {
  revalidate: 0,
  publicSecret: process.env.NEXT_PUBLIC_API_SECRET,
  publicToken: process.env.NEXT_PUBLIC_SESSION_TOKEN,
}

export const dangerouslySetInnerHtmlFixture =
  "dangerouslySetInnerHTML={{ __html: '<img src=x onerror=alert(1) />' }}"

export const nextjsSecurityFixtures = `
innerHTML = html
outerHTML = html
insertAdjacentHTML('beforeend', html)
document.write(html)
document.writeln(html)
setHeader('Content-Security-Policy', "script-src 'self' 'unsafe-inline'")
setHeader('Content-Security-Policy', "script-src 'self' 'unsafe-eval'")
window.postMessage('hello', '*')
eval(userInput)
new RegExp(userInput)
new Function('return 1')()
setTimeout('alert(1)', 0)
setInterval('alert(1)', 0)
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
rejectUnauthorized: false
fetch('http://example.com')
axios.get('http://example.com')
exec('id')
execSync('id')
spawn('sh', ['-c', 'id'])
spawnSync('sh', ['-c', 'id'])
fork('worker.js')
crypto.createHash('md5')
crypto.createHash('sha1')
Math.random()
console.log(process.env.SECRET)
localStorage.setItem('auth_token', token)
sessionStorage.setItem('api_key', key)
document.cookie = 'session=abc'
cookie: { secure: false, httpOnly: false, sameSite: 'none', domain: '.example.com', path: '/' }
origin: '*'
res.setHeader('Location', req.query.next)
redirect(searchParams.get('next'))
debug: true
yaml.load(userInput)
vm.runInThisContext(code)
new vm.Script(code)
JSON.parse(req.body)
`
