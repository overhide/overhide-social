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
   * @returns {Karnets} this
   */
  init({salt}) {

    this[ctx] = {
      salt: salt
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
    try {
      if (!('code' in req.query)) throw 'no code';
      if (!('state' in req.query)) throw 'no karnet';
      const code = req.query['code'];
      const karnet = req.query['state'];
      const {email, provider} = await auth.getToken(code);
      if (!email || !provider) throw 'bad token, no email or provider';
      let secret = await database.get(crypto.hash(email, this[ctx].salt), provider);
      if (!secret) {
        secret = crypto.createIdentity().privateKey;
        await database.add(crypto.hash(email, this[ctx].salt), provider, secret);
      }
      await karnets.setSecret(karnet, secret);
      res.render('login-success.html');
    }
    catch(err) {
      debug(`error: ${err}`);
      res.render('login-fail.html');
    }
  }

  /**
   * Sign
   * 
   * @param {{message, karnet}} req -- where message is base64 encoded.
   * @param {} res
   * @param {} next
   * @returns {{signature, address}} where signature is base64 encoded and address is '0x' prefixed.
   */
   async sign(req, res, next) {
    this[checkInit]();
    try {
      if (!('message' in req.query)) throw 'no message';
      if (!('karnet' in req.query)) throw 'no karnet';
      const message = req.query['message'];
      const karnet = req.query['karnet'];
      const secret = await karnets.getSecret(karnet);
      if (!secret) {
        res.status(403).send();
        return;
      }
      const messageText = crypto.atob(message);
      const signatureText = crypto.sign(secret, messageText);
      const signature = crypto.btoa(signatureText);
      const address = crypto.secretToAddress(secret);
      res.status(200).send({signature, address});
      return;
    }
    catch(err) {
      debug(`error: ${err}`);
      res.status(500).send(err);
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

module.exports = (new Service());