export const expressRulesFixture = {
  origin: '*',
  headerExample: "Access-Control-Allow-Origin', '*'",
  session: {
    cookie: {
      secure: false,
      httpOnly: false,
      sameSite: 'none',
      domain: '.example.com',
      path: '/',
    },
  },
}

export const expressSecurityFixtures = `
app.set('trust proxy', true)
trust proxy
helmet()
credentials: true
Access-Control-Allow-Headers', '*'
Access-Control-Allow-Methods', '*'
X-Powered-By
Content-Security-Policy', "script-src 'self' 'unsafe-inline'"
Content-Security-Policy', "script-src 'self' 'unsafe-eval'"
cookieParser('super-secret-cookie-parser')
jwt.sign(payload, 'super-secret-jwt')
algorithms: ['none']
bcrypt.hash(password, 10)
password === input
bodyParser.json()
express.json()
express.urlencoded()
upload.any()
"/tmp/uploads"
SELECT * FROM users + req.query.id
$where
new RegExp(req.query.q)
res.redirect(req.query.next)
res.redirect(302, req.query.next)
debug: true
morgan('dev')
authorization console.log
console.log(process.env.SECRET)
eval(userInput)
new Function('return 1')()
exec('id')
execSync('id')
spawn('sh', ['-c', 'id'])
spawnSync('sh', ['-c', 'id'])
fork('worker.js')
createHash('md5')
createHash('sha1')
Math.random()
'http://example.com'
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
rejectUnauthorized: false
path.join(req.params.file)
readFile(req.query.path)
writeFile(req.query.path)
http://localhost
http://127.0.0.1
169.254.169.254
app.set('view engine', 'ejs')
xml2js
graphql-playground
rateLimit()
csrf: false
secret: 'hardcoded-session-secret'
passport-local
allowlist
req.body
JSON.parse(req.body)
new RegExp(userInput)
`
