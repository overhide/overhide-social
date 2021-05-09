"use strict";

const crypto = require('crypto')
const Web3 = require('web3')
const web3 = new (Web3)();

const ENCODING = 'utf-8';
const HASH_ALGO = 'sha256';
const DIGEST_FORMAT = 'hex';
const SYMMETRIC_ALGO = 'aes-256-cbc';

// private attribtues
const ctx = Symbol('context');

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
class Crypto {
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
   * @return this
   */
  init() {
    this[ctx] = {};
    return this;
  }

  /**
   * @param {number} num - length of string
   * @returns {string<utf-8>} with random characters
   */
  randomChars(num) {
    return crypto.randomBytes(num).toString(ENCODING)    
  }

  /**
   * @param {(string<utf-8>|Buffer|TypedArray)} what - to hash
   * @param {(string<utf-8>|Buffer|TypedArray)} salt - to hash with (optional)
   * @returns {string} hashed what
   */
  hash(what, salt) {
    this[checkInit]();
    if (salt) return crypto.createHmac(HASH_ALGO, salt).update(what, ENCODING).digest(DIGEST_FORMAT);
    else return crypto.createHash(HASH_ALGO).update(what, ENCODING).digest(DIGEST_FORMAT);
  }

  /**
   * @param {(string<utf-8>|Buffer|TypedArray)} plainblob - to hash
   * @param {string<utf-8>} password
   * @returns {Buffer} cypherblob
   */
  symmetricEncrypt(plainblob, password) {
    this[checkInit]();
    var cypher = crypto.createCipher(SYMMETRIC_ALGO,password);
    return Buffer.concat([cypher.update(plainblob,ENCODING),cypher.final()]);
  }

    /**
   * @param {Buffer} cypherblob - to hash
   * @param {(string<utf-8>|Buffer|TypedArray)} password - to hash with (optional)
   * @returns {Buffer} plainblob
   */
  symmetricDecrypt(cypherblob, password) {
    this[checkInit]();
    var cypher = crypto.createDecipher(SYMMETRIC_ALGO,password);
    return Buffer.concat([cypher.update(cypherblob),cypher.final()]);
  }

  /**
   * Recover original signing address from signature for message.
   * 
   * @param {string} message - passed into 'sign'
   * @param {string} signature - returned from 'sign'
   * @returns {string} address - passed into 'sign'
   */
  recover(message, signature) {
    return web3.eth.accounts.recover(message, signature);
  }

  /**
   * @returns {Object} a new identity with newly generated key strings: {privateKey:..,address:..}
   */
  createIdentity() {
    this[checkInit]();
    return web3.eth.accounts.create();
  }

  /**
   * @param {(string|Buffer|TypedArray)} payload - to hash
   * @returns {string} the hash ('0x..')
   */
  keccak256(payload) {
    this[checkInit]();
    return crypto.createHash(HASH_ALGO).update(payload, ENCODING).digest(DIGEST_FORMAT);
  }

  /**
   * @param {string} key - private key for signing ('0x..')
   * @param {string} message - to be signed (usually hash of payload)
   * @returns {string} signed payload
   */
  sign(key, message) {
    this[checkInit]();
    return web3.eth.accounts.sign(message, key).signature;
  }

  /**
   * @param {string} secret - to get address out of, '0x..' prefixed.
   * @returns {string} the address, '0x..' prefixed.
   */
  secretToAddress(secret) {
    return web3.eth.accounts.privateKeyToAccount(secret).address;
  }

  /**
   * 
   * @param {string} address - of the public address corresponding to private key of signature
   * @param {string} signature - the signature ('0x..')
   * @param {string} message - that was signed (usually hash of payload)
   * @returns {boolean} if signature checks out
   */
  isSignatureValid(address, signature, message) {
    this[checkInit]();
    var target = web3.eth.accounts.recover(message, signature).toLowerCase();
    return (address.toLowerCase() == target);
  }

  /**
   * @param {string} what - base64 string to convert text
   */
  atob(what) {
    return Buffer.from(what, 'base64').toString();
  }

  /**
   * @param {string} what - text to convert to base64
   */
  btoa(what) {
    return Buffer.from(what).toString('base64');
  }  
}

module.exports = (new Crypto());