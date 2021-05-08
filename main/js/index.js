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
  authTokenUrl: AUTH_TOKEN_URL,
  authClientId: AUTH_CLIENT_ID,
  authClientSecret: AUTH_CLIENT_SECRET,
  authRedirectUri: AUTH_REDIRECT_URI,
  keyvUri: KEYV_URI,
  keyvKarnetsNamespace: KEYV_KARNETS_NAMESPACE,
  keyvKarnetsTtlMillis: KEYV_KARNETS_TTL_MILLIS
};
const log = require('./lib/log.js').init(ctx_config).fn("app");
const debug = require('./lib/log.js').init(ctx_config).debug_fn("app");
const crypto = require('./lib/crypto.js').init();
const database = require('./lib/database.js').init(ctx_config);
const swagger = require('./lib/swagger.js').init(ctx_config);
const auth = require('./lib/auth.js').init(ctx_config);
const karnet = require('./lib/karnet.js').init(ctx_config);
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
 *     summary: Retrieve exchange rates between a currency and US dollars.
 *     description: | 
 *       Retrieve minimum and maximum exchange rates between a currency and US dollars at a number of ISO 8601 parsable UTC time-stamps (with 'Z' at end).
 * 
 *       Each time-stamp is considered an end of a 3 hour time-window sampled for a minimum and maximum exchange rate between `currency` and US dollars.
 * 
 *       Rate limits:  30 calls / minute / IP (across all overhide APIs)
 *     parameters:
 *       - in: query
 *         name: currency
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *            Currency to retrieve conversion rate "from" &mdash; to US dollars.
 * 
 *            Supported currencies:
 * 
 *              * "eth" -- ethers
 *              * "wei" -- ethereum `wei`
 *              * "btc" -- bitcoin
 *              * "sat" -- bitcoin `satoshis`
 *       - in: query
 *         name: timestamps
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *            Comma separated list of ISO 8601 UTC time-stamps matching the pattern 'YYYY-MM-DDThh:mm:ss.fffZ'
 * 
 *            Each time-stamp is a string in [ISO 8601/RFC3339 format](https://xml2rfc.tools.ietf.org/public/rfc/html/rfc3339.html#anchor14).
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: |
 *           JSON list of objects `[{timestamp: <UNIX time (epoch) millis>, minrate: <float>, maxrate: <float>},..]` whereby `minrate` indicates
 *           the lowest conversion rate between *currency* and USD seen within a time window (configurable by service) until the `timestamp`
 *           and `maxrate` indicates the highest conversion rate within same.
 *       401:
 *         description: |
 *            These APIs require bearer tokens to be furnished in an 'Authorization' header as 'Bearer ..' values.  The tokens are to be retrieved from
 *            [https://token.overhide.io](https://token.overhide.io).
 */
app.get('/redirect',  async (req, res, next) => {
  const code = req.query['code'];
  const karnet = req.query['state'];
  next();
});

/**
 * @swagger
 * /tallymin/{currency}/{values}:
 *   get:
 *     summary: Retrieve a tally in US dollars converted at a minimum estimated exchange-rate from a stream of time-stamped-values in the provided currency.
 *     description: | 
 *       Retrieve a tally in US dollars converted at a minimum estimated exchange-rate from a stream of time-stamped-values.  A time-stamped-value is
 *       a value transfer at some time-stamp.  There is a certain exchange-rate between `currency` and US dollars at each particular time-stamp.  The
 *       exchange rate fluctuates and may have been different within some time-window before the transaction.  This call will take the lowest known
 *       exchange rate during the time-window leading up to a transaction and apply it to the transaction.  Each transaction has its own unique
 *       exchange rate as it has its own unique time-window.
 * 
 *       The result is a minimum converted value in US dollars.
 * 
 *       At present this services uses a time-window of 3 hours leading up to each transaction.  
 * 
 *       Rate limits:  30 calls / minute / IP (across all overhide APIs)
 *     parameters:
 *       - in: path
 *         name: currency
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *            Currency and denomination of the time-stamped-values.
 * 
 *            Supported currencies/denominations:
 * 
 *              * "eth" -- ethers
 *              * "wei" -- ethereum `wei`
 *              * "btc" -- bitcoin
 *              * "sat" -- bitcoin `satoshis`
 *       - in: path
 *         name: values
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *            Comma separated list of ISO 8601 UTC time-stamps matching the pattern 'YYYY-MM-DDThh:mm:ss.fffZ' prefixed with a `<amount>@`
 *            `currency` value.  E.g. `1200000000000000000@2020-01-04T11:00:00.000Z` for a currency of `wei` signifies a transaction of 1.2 ethers
 *            on April first at 11 (UTC).            
 * 
 *            Each time-stamp is a string in [ISO 8601/RFC3339 format](https://xml2rfc.tools.ietf.org/public/rfc/html/rfc3339.html#anchor14).
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: |
 *           A minimum US dollar tally of the transaction stream.
 *       401:
 *         description: |
 *            These APIs require bearer tokens to be furnished in an 'Authorization' header as 'Bearer ..' values.  The tokens are to be retrieved from
 *            [https://token.overhide.io](https://token.overhide.io).
 */
app.get('/sign', token, throttle, async (req, res, next) => {
  if (await service.tallyMin(req, res)) {
    next();
  }
});

/**
 * @swagger
 * /tallymax/{currency}/{values}:
 *   get:
 *     summary: Retrieve a tally in US dollars converted at a maximum estimated exchange-rate from a stream of time-stamped-values in the provided currency.
 *     description: | 
 *       Retrieve a tally in US dollars converted at a maximum estimated exchange-rate from a stream of time-stamped-values.  A time-stamped-value is
 *       a value transfer at some time-stamp.  There is a certain exchange-rate between `currency` and US dollars at each particular time-stamp.  The
 *       exchange rate fluctuates and may have been different within some time-window before the transaction.  This call will take the highest known
 *       exchange rate during the time-window leading up to a transaction and apply it to the transaction.  Each transaction has its own unique
 *       exchange rate as it has its own unique time-window.
 * 
 *       The result is a maximum converted value in US dollars.
 * 
 *       At present this services uses a time-window of 3 hours leading up to each transaction.  
 * 
 *       Rate limits:  30 calls / minute / IP (across all overhide APIs)
 *     parameters:
 *       - in: path
 *         name: currency
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *            Currency and denomination of the transactions.
 * 
 *            Supported currencies/denominations:
 * 
 *              * "eth" -- ethers
 *              * "wei" -- ethereum `wei`
 *              * "btc" -- bitcoin
 *              * "sat" -- bitcoin `satoshis`
 *       - in: path
 *         name: values
 *         required: true
 *         schema:
 *           type: string
 *         description: |
 *            Comma separated list of ISO 8601 UTC time-stamps matching the pattern 'YYYY-MM-DDThh:mm:ss.fffZ' prefixed with a `<amount>@`
 *            `currency` value.  E.g. `1200000000000000000@2020-01-04T11:00:00.000Z` for a currency of `wei` signifies a transaction of 1.2 ethers
 *            on April first at 11 (UTC).            
 * 
 *            Each time-stamp is a string in [ISO 8601/RFC3339 format](https://xml2rfc.tools.ietf.org/public/rfc/html/rfc3339.html#anchor14).
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: |
 *           A maximum US dollar tally of the transaction stream.
 *       401:
 *         description: |
 *            These APIs require bearer tokens to be furnished in an 'Authorization' header as 'Bearer ..' values.  The tokens are to be retrieved from
 *            [https://token.overhide.io](https://token.overhide.io).
 */
app.get('/get', token, throttle, async (req, res, next) => {
  if (await service.tallyMax(req, res)) {
    next();
  };  
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
  const karnetMetrics = await karnet.metrics();
  var healthy = authMetrics.errorsDelta === 0 && dbError;
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
    karnet: karnetMetrics
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