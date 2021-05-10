const { expect } = require('chai');
const chai = require('chai');
const assert = chai.assert;
const mock = require('mock-require');

const POSTGRES_HOST = process.env.POSTGRES_HOST || process.env.npm_config_POSTGRES_HOST || process.env.npm_package_config_POSTGRES_HOST || 'localhost';
const POSTGRES_PORT = process.env.POSTGRES_PORT || process.env.npm_config_POSTGRES_PORT || process.env.npm_package_config_POSTGRES_PORT || 5432;
const POSTGRES_DB = process.env.POSTGRES_DB || process.env.npm_config_POSTGRES_DB || process.env.npm_package_config_POSTGRES_DB || 'oh-social'; 
const POSTGRES_USER = process.env.POSTGRES_USER || process.env.npm_config_POSTGRES_USER || process.env.npm_package_config_POSTGRES_USER || 'adam';
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || process.env.npm_config_POSTGRES_PASSWORD || process.env.npm_package_config_POSTGRES_PASSWORD || 'c0c0nut';
const POSTGRES_SSL = process.env.POSTGRES_SSL || process.env.npm_config_POSTGRES_SSL || process.env.npm_package_config_POSTGRES_SSL;

const SALT = process.env.SALT || process.env.npm_config_SALT || process.env.npm_package_config_SALT || 'salt';

const AUTH_TOKEN_URL = process.env.AUTH_TOKEN_URL || process.env.npm_config_AUTH_TOKEN_URL || process.env.npm_package_config_AUTH_TOKEN_URL || `{"microsoft": "https://token", "google": "https://token"}`;
const AUTH_CLIENT_ID = process.env.AUTH_CLIENT_ID || process.env.npm_config_AUTH_CLIENT_ID || process.env.npm_package_config_AUTH_CLIENT_ID || 'clientId';
const AUTH_CLIENT_SECRET = process.env.AUTH_CLIENT_SECRET || process.env.npm_config_AUTH_CLIENT_SECRET || process.env.npm_package_config_AUTH_CLIENT_SECRET || 'clientSecret';
const AUTH_REDIRECT_URI = process.env.AUTH_REDIRECT_URI || process.env.npm_config_AUTH_REDIRECT_URI || process.env.npm_package_config_AUTH_REDIRECT_URI || 'https://localhost:8120/redirect';
const KEYV_URI = process.env.KEYV_URI || process.env.npm_config_KEYV_URI || process.env.npm_package_config_KEYV_URI || 'redis://localhost:6379';
const KEYV_KARNETS_NAMESPACE = process.env.KEYV_KARNETS_NAMESPACE || process.env.npm_config_KEYV_KARNETS_NAMESPACE || process.env.npm_package_config_KEYV_KARNETS_NAMESPACE || 'karnets';
const KEYV_KARNETS_TTL_MILLIS = process.env.KEYV_KARNETS_TTL_MILLIS || process.env.npm_config_KEYV_KARNETS_TTL_MILLIS || process.env.npm_package_config_KEYV_KARNETS_TTL_MILLIS || 120000;

var returnGoodToken = true;

// good token below:
//
// {
//   "alg": "HS256",
//   "typ": "JWT"
// }.{
//   "sub": "1234567890",
//   "name": "John Doe",
//   "iat": 1516239022,
//   "emails": [
//     "foo@bar.com"
//   ],
//   "idp": "live.com"
// }.[Signature]

mock('node-fetch', async (url) => {
  if (url.match(/token/) && returnGoodToken) {
    return {
      status: 200,
      text: async () => 'OK',
      json: async () => {
        return {id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJlbWFpbHMiOlsiZm9vQGJhci5jb20iXSwiaWRwIjoibGl2ZS5jb20ifQ.43i8B6VywQv973oJoy5GF2C3hAHnlhB5XJbVpmMZjPo'};
      }
    };
  }
  if (url.match(/token/) && !returnGoodToken) {
    return {
      status: 400,
      text: async () => 'invalid_grant',
      json: async () => {
        return {error: 'invlaid_grant'};
      }
    };
  }
});

function roundToHour(epochTime) {
  const hour = 1000 * 60 * 60;
  return Math.floor(epochTime / hour) * hour;
}

const ctx_config = {
  pghost: POSTGRES_HOST,
  pgport: POSTGRES_PORT,
  pgdatabase: POSTGRES_DB,
  pguser: POSTGRES_USER,
  pgpassword: POSTGRES_PASSWORD,
  pgssl: POSTGRES_SSL,
  salt: SALT,
  authTokenUrl: JSON.parse(AUTH_TOKEN_URL),
  authClientId: AUTH_CLIENT_ID,
  authClientSecret: AUTH_CLIENT_SECRET,
  authRedirectUri: AUTH_REDIRECT_URI,
  keyvUri: KEYV_URI,
  keyvKarnetsNamespace: KEYV_KARNETS_NAMESPACE,
  keyvKarnetsTtlMillis: KEYV_KARNETS_TTL_MILLIS  
};

require('../../main/js/lib/log.js').init({app_name:'smoke'});
const crypto = require('../../main/js/lib/crypto.js').init(ctx_config);
const database = require('../../main/js/lib/database.js').init(ctx_config);
const auth = require('../../main/js/lib/auth.js').init(ctx_config);
const karnets = require('../../main/js/lib/karnets.js').init(ctx_config);
const service = require('../../main/js/lib/service.js').init(ctx_config);

const goodKarnet = `karnet_${new Date()}`;
const badKarnet = `badKarnet_${new Date()}`;

describe('service tests', () => {

  /**************/
  /* The tests. */
  /**************/

  it('should get token, register new secret, cache karnet, and return page raising oh$-login-success event', (done) => {
    (async () => {

      req = {
        params: {
          provider: 'microsoft'
        },
        query: {
          code: 'goodCode',
          state: goodKarnet
        }
      }

      res = {
        render: (template, opts) => {
          assert.isTrue(/login-success.html/.test(template));
          done();
        }
      }
  
      await service.redirect(req, res, () => {});
    })();
  });

  it('should retrieve a signature for previous goodKarnet', (done) => {
    (async () => {

      req = {
        params: {
          provider: 'microsoft'
        },
        query: {
          message: crypto.btoa('message'),
          karnet: goodKarnet
        }
      }

      res = {
        status: (code) => {
          return {
            send: (result) => {
              if (code == 200)  {                
                assert.isTrue(crypto.isSignatureValid(result.address, crypto.atob(result.signature), 'message'));
                done();
              };    
            }
          }
        }        
      }
  
      await service.sign(req, res, () => {});
    })();
  });  

  it('should get token of already registered secret, cache karnet, and return page raising oh$-login-success event', (done) => {
    (async () => {

      req = {
        params: {
          provider: 'microsoft'
        },
        query: {
          code: 'goodCode',
          state: goodKarnet
        }
      }

      res = {
        render: (template, opts) => {
          assert.isTrue(/login-success.html/.test(template));
          done();
        }
      }
  
      await service.redirect(req, res, () => {});
    })();
  });  

  it('should return oh$-login-failed on bad token', (done) => {
    (async () => {

      returnGoodToken = false; 

      req = {
        params: {
          provider: 'microsoft'
        },
        query: {
          code: 'goodCode',
          state: goodKarnet
        }
      }

      res = {
        render: (template, opts) => {
          assert.isTrue(/login-fail.html/.test(template));
          done();
        }
      }
  
      await service.redirect(req, res, () => {});
    })();
  });  

  it('should get 403 when karnet not cached', (done) => {
    (async () => {

      req = {
        params: {
          provider: 'microsoft'
        },
        query: {
          message: 'message',
          karnet: badKarnet
        }
      }

      res = {
        status: (code) => {
          return {
            send: (result) => {
              if (code == 403)  {
                done();
              };    
            }
          }
        }        
      }
  
      await service.sign(req, res, () => {});
    })();
  });  
})

