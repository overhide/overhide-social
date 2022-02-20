"use strict";

const Keyv = require('keyv');
const debug = require('./log.js').debug_fn("karnets");
const log = require('./log.js').fn("karnets");
const crypto = require('./crypto.js');

// private attribtues
const ctx = Symbol('context');
const metrics = Symbol('metrics');

// private functions
const checkInit = Symbol('checkInit');
const getKeyv = Symbol('getKeyv');

/**
 * Wires up functionality we use throughout.
 * 
 * Module returns this class as object all wired-up.  Before you can use the methods you must "init" the object 
 * somewhere at process start.
 * 
 * Leverages node's module system for a sort of context & dependency injection, so order of requiring and initializing
 * these sorts of libraries matters.
 */
class Karnets {
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
  init({ salt, keyvUri, keyvKarnetsNamespace, keyvKarnetsTtlMillis}) {
    if (!salt) throw new Error("SALT must be specified.");
    if (!keyvUri) log("WARNING:  KEYV_URI not be specified--using in-memory store");
    if (!keyvKarnetsNamespace) throw new Error("KEYV_KARNETS_NAMESPACE must be specified.")
    if (!keyvKarnetsTtlMillis) throw new Error("KEYV_KARNETS_TTL_MILLIS must be specified.")

    this[ctx] = {
      salt: salt,
      uri: keyvUri,
      namespace: keyvKarnetsNamespace,
      ttl: parseInt(keyvKarnetsTtlMillis)
    };

    this[ctx].keyv = this[getKeyv]();

    this[metrics] = {
      hit: 0,
      miss: 0
    };

    return this;
  }

  // @return A 'keyv' datastore instance for authenticated users
  [getKeyv]() {
    return new Keyv({
      uri: typeof this[ctx].uri === 'string' && this[ctx].uri,
      store: typeof this[ctx].uri !== 'string' && this[ctx].uri,
      namespace: this[ctx].namespace
    });
  }

  /**
   * Set secret
   * 
   * @param {string} karnet 
   * @param {BBuffer} encryptedSecret
   */
   async setSecret(karnet, encryptedSecret) {
    this[checkInit]();
    debug(`store secret for ${karnet}`);
    await this[ctx].keyv.set(karnet, encryptedSecret, this[ctx].ttl);
  }

  /**
   * Set secret
   * 
   * @param {string} karnet 
   * @param {BBuffer} encryptedSecret
   */
   async deleteSecret(karnet) {
    this[checkInit]();
    await this[ctx].keyv.delete(karnet);
  }

  /**
   * Get secret
   * 
   * @param {string} karnet 
   * @returns {Buffer} encryptedSecret
   */
  async getSecret(karnet) {
    this[checkInit]();
    const val = await this[ctx].keyv.get(karnet);
    if (val) {
      this[metrics].hit++;
      debug(`got secret for karnet ${karnet}`);
      return val;
    } else {
      this[metrics].miss++;
      debug(`missed secret for karnet ${karnet}`);
      return null;
    }
  }

  /**
   * @returns {Object} metrics object.
   */
  metrics() {
    this[checkInit]();
    return this[metrics];
  }
}

module.exports = (new Karnets());