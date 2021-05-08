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
const SELECT_MAX_ROWS = process.env.SELECT_MAX_ROWS || process.env.npm_config_SELECT_MAX_ROWS || process.env.npm_package_config_SELECT_MAX_ROWS || 30;

mock('node-fetch', async (url) => {
  if (url.match(/all_txs/)) {
    return {
      status: 200,
      text: async () => 'OK',
      json: async () => {
      }
    };
  }
  if (url.match(/twentyfive.*chain/)) {
    return {
      status: 200,
      text: async () => 'OK',
      json: async () => {
        return [];
      }
    };
  }
});

function roundToHour(epochTime) {
  const hour = 1000 * 60 * 60;
  return Math.floor(epochTime / hour) * hour;
}

require('../../main/js/lib/log.js').init({app_name:'smoke'});
const database = require('../../main/js/lib/database.js').init({
  pghost: POSTGRES_HOST,
  pgport: POSTGRES_PORT,
  pgdatabase: POSTGRES_DB,
  pguser: POSTGRES_USER,
  pgpassword: POSTGRES_PASSWORD,
  pgssl: POSTGRES_SSL,
  select_max_rows: SELECT_MAX_ROWS
});
const timestamp = require('../../main/js/lib/timestamp.js').init();
const rates = require('../../main/js/lib/rates.js').init();
const service = require('../../main/js/lib/service.js').init();

describe('service tests', () => {

  /**************/
  /* The tests. */
  /**************/

  it('should get() smoke', (done) => {
    (async () => {

      req = {
        params: {
          currency: 'eth',
          timestamps: (new Date(baseTime)).toISOString()
        }
      }

      res = {
        status: (code) => {
          return {
            send: (result) => {
              if (code == 200)  {
                assert.isTrue(result.length == 1);
                assert.isTrue(result[0].timestamp == baseTime);
                assert.isTrue(result[0].minrate == 6);
                assert.isTrue(result[0].maxrate == 8);
                done();
              };    
            }
          }
        }        
      }
  
      resultAsTuples = await service.get(req, res);
    })();
  });

  it('should get() smoke -- multiple timestamps', (done) => {
    (async () => {

      req = {
        params: {
          currency: 'eth',
          timestamps: (new Date(baseTime)).toISOString() + ',' + (new Date(baseTime - hour * 2)).toISOString() + ',' + (new Date(baseTime - hour * 3)).toISOString()
        }
      }

      res = {
        status: (code) => {
          return {
            send: (result) => {
              if (code == 200)  {
                assert.isTrue(result.length == 3);
                assert.isTrue(result.some(r => r.timestamp == baseTime && r.minrate == 6 && r.maxrate == 8));
                assert.isTrue(result.some(r => r.timestamp == (baseTime - hour * 2) && r.minrate == 1 && r.maxrate == 7));
                assert.isTrue(result.some(r => r.timestamp == (baseTime - hour * 3) && r.minrate == 1 && r.maxrate == 6));
                done();
              };    
            }
          }
        }        
      }
  
      resultAsTuples = await service.get(req, res);
    })();
  });

  it('should tallyMin() smoke -- multiple timestamps', (done) => {
    (async () => {

      req = {
        params: {
          currency: 'eth',
          values: 
            '0.5@' + (new Date(baseTime)).toISOString()                  // 1/2  ether
            + ',0.25@' + (new Date(baseTime - hour * 2)).toISOString()    // 1/4  ether
            + ',0.1@' + (new Date(baseTime - hour * 3)).toISOString()    // 1/10 ether
        }
      }

      res = {
        status: (code) => {
          return {
            send: (result) => {
              if (code == 200)  {
                assert.isTrue(result == 3.35);                 
                done();
              };    
            }
          }
        }        
      }
  
      resultAsTuples = await service.tallyMin(req, res);
    })();
  });

  it('should tallyMax() smoke -- multiple timestamps', (done) => {
    (async () => {

      req = {
        params: {
          currency: 'wei',
          values: 
            '500000000000000000@' + (new Date(baseTime)).toISOString()                  // 1/2  ether
            + ',250000000000000000@' + (new Date(baseTime - hour * 2)).toISOString()    // 1/4  ether
            + ',100000000000000000@' + (new Date(baseTime - hour * 3)).toISOString()    // 1/10 ether
        }
      }

      res = {
        status: (code) => {
          return {
            send: (result) => {
              if (code == 200)  {  
                assert.isTrue(result == 6.35);               
                done();
              };    
            }
          }
        }        
      }
  
      resultAsTuples = await service.tallyMax(req, res);
    })();
  });  
})

