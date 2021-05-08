"use strict";

const debug = require('./log.js').debug_fn("auth");
const fetch = require('node-fetch');
const jwt_decode = require('jwt-decode');

// private attribtues
const ctx = Symbol('context');
const metrics = Symbol('metrics');

// private functions
const checkInit = Symbol('checkInit');

/**
 * Wires up functionality we use throughout.
 * 
 * Module returns this class as object all wired-up.  Before you can use the methods you must "init" the object 
 * somewhere at process start.
 * 
 * Leverages node's module system for a sort of context & dependency injection, so order of requiring and initializing
 * these sorts of libraries matters.
 */
class Auth {
  constructor() {
    this[ctx] = null;
  }

  // ensure this is initialized
  [checkInit]() {
    if (! this[ctx]) throw new Error('library not initialized, call "init" when wiring up app first');
  }

  /**
   * Initialize this library: this must be the first method called somewhere from where you're doing context & dependency
   * injection.
   * 
   * @param {string} authTokenUrl - URL for validating tokens
   * @param {string} authClientId
   * @param {string} authClientSecret
   * @param {stirng} authRedirectUri
   * @returns {Token} this
   */
  init({authTokenUrl, authClientId, authClientSecret, authRedirectUri} = {}) {
    if (authTokenUrl == null) throw new Error("AUTH_TOKEN_URL must be specified.");
    if (authClientId == null) throw new Error("AUTH_CLIENT_ID must be specified.");
    if (authClientSecret == null) throw new Error("AUTH_CLIENT_SECRET must be specified.");
    if (authRedirectUri == null) throw new Error("AUTH_REDIRECT_URI must be specified.");

    this[ctx] = {
      authTokenUrl: authTokenUrl,
      authClientId: authClientId,
      authClientSecret: authClientSecret,
      authRedirectUri: authRedirectUri
    };
    this[metrics] = {
      errors: 0,
      errorsLastCheck: 0,
      errorsDelta: 0,
      success: 0,
      fail: 0
    };    
    return this;
  }

  /**
   * See if we can retrieve the token.
   * tokenUrl, 
   * @param {}  code
   * @returns {{email:..,provider:..}} the token data
   */
  async getToken(code) {
    this[checkInit]();
    const content = `grant_type=authorization_code&client_id=${this[ctx].authClientId}&client_secret=${this[ctx].authClientSecret}&scope=${this[ctx].authClientId}&code=${code}&redirect_uri=${this[ctx].authRedirectUri}`;
    let response = await fetch(this[ctx].authTokenUrl, content, {
      method: 'POST', headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    });
    if (response.status != 200) {
      let text = await response.text();
      this[metrics].fail++;
      throw `GET ${url} code: ${response.status} error: ${text}`;
    }
    try {
      const token = await response.json();
      const decoded = jwt_decode(token.id_token);
      const result = {email: decoded.emails[0], provider: decoded.idp}  
      this[metrics].success++;
      return result;
    } catch (err) {
      debug(`error getting token: ${err}`);
      this[metrics].fail++;
      throw err;
    }
  }

  /**
   * @returns {{errors:.., errorsDelta:..}} metrics object.
   */
   metrics() {
    this[checkInit]();
    this[metrics].errorsDelta = this[metrics].errors - this[metrics].errorsLastCheck;
    this[metrics].errorsLastCheck = this[metrics].errors;
    return this[metrics];
  }
}

module.exports = (new Auth());