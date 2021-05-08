"use strict";

const debug = require('./log.js').debug_fn("service");
const log = require('./log.js').fn("service");
const auth = require('./auth.js');
const crypto = require('./crypto.js');
const database = require('./database.js');
const karnets = require('./karnets.js');

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
class Service {
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
   * @param {string} salt - salt for token decryption: if provided, tokenUrl is ignored.
   * @param {string} keyvUri - 'keyv' adapter uri for key-value abstraction 'keyv'
   * @param {string} keyvKarnetsNamespace - namespace to use in 'keyv' data store for client generated tokens
   * @param {number} keyvKarnetsTtlMillis - time to live in milliseconds for each client generated token
   * @returns {Karnets} this
   */
  init() {

    this[ctx] = {
    };

    this[metrics] = {
      redirect: 0,
      sign: 0
    };

    return this;
  }

  /**
   * Redirect
   * 
   * @param {} req
   * @param {} res
   * @param {} next
   */
   async redirect(req, res, next) {
    this[checkInit]();
    res.render('login-success.html');
    next();
  }

  /**
   * @returns {Object} metrics object.
   */
  metrics() {
    this[checkInit]();
    return this[metrics];
  }
}

module.exports = (new Service());