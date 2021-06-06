const allow_cors = require('cors')();
const http = require('http');
const express = require('express');
const {createTerminus: terminus, HealthCheckError} = require('@godaddy/terminus');
const ejs = require('ejs');
const os = require('os');
const path = require('path');

// CONFIGURATION CONSTANTS
//
// Try fetching from environment first (for Docker overrides etc.) then from npm config; fail-over to 
// hardcoded defaults.
const APP_NAME = "overhide-social";
const VERSION = process.env.npm_package_version;
const PROTOCOL = process.env.PROTOCOL || process.env.npm_config_PROTOCOL || process.env.npm_package_config_PROTOCOL;
const BASE_URL = process.env.BASE_URL || process.env.npm_config_BASE_URL || process.env.npm_package_config_BASE_URL || 'localhost:8120';
const PORT = process.env.PORT || process.env.npm_config_PORT || process.env.npm_package_config_PORT || 8120;
const DEBUG = process.env.DEBUG || process.env.npm_config_DEBUG || process.env.npm_package_config_DEBUG || 'overhide-social*';
const RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS || process.env.npm_config_RATE_LIMIT_WINDOW_MS || process.env.npm_package_config_RATE_LIMIT_WINDOW_MS || 60000;
const RATE_LIMIT_MAX_REQUESTS_PER_WINDOW = process.env.RATE_LIMIT_MAX_REQUESTS_PER_WINDOW || process.env.npm_config_RATE_LIMIT_MAX_REQUESTS_PER_WINDOW || process.env.npm_package_config_RATE_LIMIT_MAX_REQUESTS_PER_WINDOW || 10;
const RATE_LIMIT_REDIS_URI = process.env.RATE_LIMIT_REDIS_URI || process.env.npm_config_RATE_LIMIT_REDIS_URI || process.env.npm_package_config_RATE_LIMIT_REDIS_URI || null;
const RATE_LIMIT_REDIS_NAMESPACE = process.env.RATE_LIMIT_REDIS_NAMESPACE || process.env.npm_config_RATE_LIMIT_REDIS_NAMESPACE || process.env.npm_package_config_RATE_LIMIT_REDIS_NAMESPACE || "rate-limit";
const POSTGRES_HOST = process.env.POSTGRES_HOST || process.env.npm_config_POSTGRES_HOST || process.env.npm_package_config_POSTGRES_HOST || 'postgres'
const POSTGRES_PORT = process.env.POSTGRES_PORT || process.env.npm_config_POSTGRES_PORT || process.env.npm_package_config_POSTGRES_PORT || 5432
const POSTGRES_DB = process.env.POSTGRES_DB || process.env.npm_config_POSTGRES_DB || process.env.npm_package_config_POSTGRES_DB || 'oh-social';
const POSTGRES_USER = process.env.POSTGRES_USER || process.env.npm_config_POSTGRES_USER || process.env.npm_package_config_POSTGRES_USER || 'adam';
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || process.env.npm_config_POSTGRES_PASSWORD || process.env.npm_package_config_POSTGRES_PASSWORD || 'c0c0nut';
const POSTGRES_SSL = process.env.POSTGRES_SSL || process.env.npm_config_POSTGRES_SSL || process.env.npm_package_config_POSTGRES_SSL;
const SALT = process.env.SALT || process.env.npm_config_SALT || process.env.npm_package_config_SALT;
const ISPROD = process.env.ISPROD || process.env.npm_config_ISPROD || process.env.npm_package_config_ISPROD || false;
const TOKEN_URL = process.env.TOKEN_URL || process.env.npm_config_TOKEN_URL || process.env.npm_package_config_TOKEN_URL;
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN || process.env.npm_config_INTERNAL_TOKEN || process.env.npm_package_config_INTERNAL_TOKEN || null;
const AUTH_TOKEN_URL = process.env.AUTH_TOKEN_URL || process.env.npm_config_AUTH_TOKEN_URL || process.env.npm_package_config_AUTH_TOKEN_URL;
const SKIP_ENV_VERIFICATION_LOCAL_TOKENS = process.env.SKIP_ENV_VERIFICATION_LOCAL_TOKENS || process.env.npm_config_SKIP_ENV_VERIFICATION_LOCAL_TOKENS || process.env.npm_package_config_SKIP_ENV_VERIFICATION_LOCAL_TOKENS || true;
const AUTH_CLIENT_ID = process.env.AUTH_CLIENT_ID || process.env.npm_config_AUTH_CLIENT_ID || process.env.npm_package_config_AUTH_CLIENT_ID;
const AUTH_CLIENT_SECRET = process.env.AUTH_CLIENT_SECRET || process.env.npm_config_AUTH_CLIENT_SECRET || process.env.npm_package_config_AUTH_CLIENT_SECRET;
const AUTH_REDIRECT_URI = process.env.AUTH_REDIRECT_URI || process.env.npm_config_AUTH_REDIRECT_URI || process.env.npm_package_config_AUTH_REDIRECT_URI;
const KEYV_URI = process.env.KEYV_URI || process.env.npm_config_KEYV_URI || process.env.npm_package_config_KEYV_URI;
const KEYV_KARNETS_NAMESPACE = process.env.KEYV_KARNETS_NAMESPACE || process.env.npm_config_KEYV_KARNETS_NAMESPACE || process.env.npm_package_config_KEYV_KARNETS_NAMESPACE;
const KEYV_KARNETS_TTL_MILLIS = process.env.KEYV_KARNETS_TTL_MILLIS || process.env.npm_config_KEYV_KARNETS_TTL_MILLIS || process.env.npm_package_config_KEYV_KARNETS_TTL_MILLIS;
const URI = `${PROTOCOL}://${BASE_URL}`;
const DOMAIN = BASE_URL.split(':')[0];

// Wire up application context
const ctx_config = {
  pid: process.pid,
  app_name: APP_NAME,
  version: VERSION,
  base_url: BASE_URL,
  swagger_endpoints_path: __dirname + path.sep + 'index.js',
  uri: URI,
  port: PORT,
  debug: DEBUG,
  rateLimitWindowsMs: RATE_LIMIT_WINDOW_MS,
  rateLimitMax: RATE_LIMIT_MAX_REQUESTS_PER_WINDOW,
  rateLimitRedis: RATE_LIMIT_REDIS_URI,
  rateLimitRedisNamespace: RATE_LIMIT_REDIS_NAMESPACE,
  pghost: POSTGRES_HOST,
  pgport: POSTGRES_PORT,
  pgdatabase: POSTGRES_DB,
  pguser: POSTGRES_USER,
  pgpassword: POSTGRES_PASSWORD,
  pgssl: !!POSTGRES_SSL,
  salt: SALT,
  isTest: !ISPROD,
  tokenUrl: TOKEN_URL,
  internalToken: INTERNAL_TOKEN,
  skipEnvironmentVerificationForLocalSaltTokens: SKIP_ENV_VERIFICATION_LOCAL_TOKENS,
  authTokenUrl: JSON.parse(AUTH_TOKEN_URL),
  authClientId: AUTH_CLIENT_ID,
  authClientSecret: AUTH_CLIENT_SECRET,
  authRedirectUri: AUTH_REDIRECT_URI,
  keyvUri: KEYV_URI,
  keyvKarnetsNamespace: KEYV_KARNETS_NAMESPACE,
  keyvKarnetsTtlMillis: KEYV_KARNETS_TTL_MILLIS
};
const log = require('./lib/log.js').init(ctx_config).fn("app");
const debug = require('./lib/log.js').init(ctx_config).debug_fn("app");
const crypto = require('./lib/crypto.js').init(ctx_config);
const database = require('./lib/database.js').init(ctx_config);
const swagger = require('./lib/swagger.js').init(ctx_config);
const auth = require('./lib/auth.js').init(ctx_config);
const karnets = require('./lib/karnets.js').init(ctx_config);
const service = require('./lib/service.js').init(ctx_config);
const token = require('./lib/token.js').check.bind(require('./lib/token.js').init(ctx_config));
const throttle = require('./lib/throttle.js').check.bind(require('./lib/throttle.js').init(ctx_config));
log("CONFIG:\n%O", ((cfg) => {
  cfg.pgpassword = cfg.pgpassword.replace(/.(?=.{2})/g,'*'); 
  cfg.salt = cfg.salt.replace(/.(?=.{2})/g,'*'); 
  cfg.internalToken = cfg.internalToken.replace(/.(?=.{2})/g,'*'); 
  cfg.authClientSecret = cfg.authClientSecret.replace(/.(?=.{2})/g,'*'); 
  return cfg;
})({...ctx_config}));

var RENDER_PARAMS = {
  uri: URI,
};

// MIDDLEWARE

const app = express();
app.use(express.static(__dirname + `${path.sep}..${path.sep}static`));
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.set('views', __dirname + `${path.sep}..${path.sep}static`);
app.engine('html', ejs.renderFile);
app.engine('template', ejs.renderFile);
app.use(allow_cors);

// ROUTES

app.get('/swagger.json', throttle, (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swagger.render());
});

/**
 * @swagger
 * /redirect:
 *   get:
 *     summary: AAD B2C redirect endpoint.
 *     description: | 
 *       Endpoint authentication from AAD B2C will redirect to.
 * 
 *       The passed in client `karnet` (token) GUID is remembered for 2 minutes:  call the `sign` endpoint within that time to get a signature and the
 *       stored address.
 * 
 *       If this redirect is for a new email/provider combination (new login to the system), it will genereate the credentials for signing.
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *            Which social login provider's authN is this redirect for?
 * 
 *            Supported providers:
 * 
 *              * "microsoft"
 *              * "google"
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *            Authorization code to pass to `token` endpoint.
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *            The client `karnet` (token), a GUID.
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: |
 *           An HTML page that sets `window.localStorage.setItem('overhide-social-state','error')` on error or `window.localStorage.setItem('overhide-social-state','success')` on login success, and subsequently closes the browser window with `window.close()`.
 */
app.get('/redirect/:provider',  async (req, res, next) => {
  log(`/redirect params:${JSON.stringify(req.params)} query:${JSON.stringify(req.query)}`);
  await service.redirect(req, res, next);
});

/**
 * @swagger
 * /logout:
 *   get:
 *     summary: AAD B2C logout redirect endpoint.
 *     description: | 
 *       AAD B2C logout redirect endpoint.
 * 
 *       Issues a `message` event with `{event: 'oh$-logout-success', detail:'ok'}` payload.
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: |
 *           An HTML page that raises the `message` event with `{event: 'oh$-logout-success', detail:'ok'}` payload.
 */
 app.get('/logout',  async (req, res, next) => {
  log(`/logout params:${JSON.stringify(req.params)} query:${JSON.stringify(req.query)}`);
  res.render('logout-success.html');
});

/**
 * @swagger
 * /pending:
 *   get:
 *     summary: Provides a 'pending' page that waits on the redirect endpoint then raises the `oh$-login-success` event.
 *     description: | 
 *       This is used by [ledgers.js](https://www.npmjs.com/package/ledgers.js).
 * 
 *       Renders a page that does the following:
 *         - clears overhide-social-state: `window.localStorage.removeItem('overhide-social-state')`
 *         - renders a "pending" message
 *         - on a timer starts checking for availability of `window.localStorage.getItem('overhide-social-state')`
 *         - once available, raises a `message` event with either 'oh$-login-success' or 'oh$-login-failed' as `{event: ..}` payload depending on state: i.e. `window.parent.postMessage({event: 'oh$-login-success'}, '*');)`
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: |
 *           An HTML page that raises the `message` event with either 'oh$-login-success' or 'oh$-login-failed' as `{event: ..}` payload.
 */
 app.get('/pending',  async (req, res, next) => {
  res.render('social-pending.html');
});

/**
 * @swagger
 * /sign:
 *   get:
 *     summary: Pass in the client `karnet` (token) GUID and a `message` to sign -- signs the message with credentials tracked by this service for the previously logged in `karnet`.
 *     description: | 
 *       Pass in the client `karnet` (token) GUID and a `message` to sign -- signs the message with credentials tracked by this service for the previously 
 *       logged in `karnet`.
 * 
 *       Rate limits:  30 calls / minute / IP (across all overhide APIs)
 *     parameters:
 *       - in: query
 *         name: karnet
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *           The client `karnet` (token) GUID that is logged in and has credentials stored by this service.
 *       - in: query
 *         name: message
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *           The message to sign, base64 encoded.
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: |
 *           The signature and corresponding address.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - signature
 *                 - address
 *               properties:
 *                 signature:
 *                   type: string
 *                   description: |
 *                     Base64 encoded signature.
 *                 address:
 *                   type: string
 *                   description: |
 *                     The *overhide-ledger* public address for this login email/provider combination: '0x' prefixed Ethereum address.
 *       401:
 *         description: |
 *            These APIs require bearer tokens to be furnished in an 'Authorization' header as 'Bearer ..' values.  The tokens are to be retrieved from
 *            [https://token.overhide.io](https://token.overhide.io).
 *       403:
 *         description: |
 *            Unauthorized `karnet` provided (expired?).
 */
app.get('/sign', token, throttle, async (req, res, next) => {
  log(`/sign params:${JSON.stringify(req.params)} query:${JSON.stringify(req.query)}`);
  await service.sign(req, res, next);
});

// SERVER LIFECYCLE

const server = http.createServer(app);

function onSignal() {
  log('terminating: starting cleanup');
  return Promise.all([
    database.terminate()
  ]);
}

async function onHealthCheck() {
  const authMetrics = auth.metrics();
  const dbError = await database.getError();
  const karnetMetrics = await karnets.metrics();
  const serviceMetrics = await service.metrics();  
  var healthy = authMetrics.errorsDelta === 0 && !dbError;
  if (!healthy) {
    let reason = `onHealthCheck failed (authMetrics.errorsDelta: ${authMetrics.errorsDelta})(db.error: ${dbError})`;
    log(reason);
    throw new HealthCheckError('healtcheck failed', [reason])
  }
  let status = {
    host: os.hostname(),
    version: VERSION,
    database: 'OK',
    auth: authMetrics,
    karnet: karnetMetrics,
    serivce: serviceMetrics
  };
  return status;
}

terminus(server, {
  signal: 'SIGINT',
   healthChecks: {
    '/status.json': onHealthCheck,
  },
  onSignal
});

server.listen(PORT);