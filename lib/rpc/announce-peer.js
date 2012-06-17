var RPC = require('kadoh').network.rpc.RPC;

var AnnouncePeer = module.exports = RPC.extend({

  initialize: function(queried, info_hash, port, token) {
    if (arguments.length === 0) {
      this.supr();
    } else {
      this.supr(queried, 'ANNOUNCE_PEER', [info_hash, port, token]);
    }
  },

  getInfoHash: function() {
    return this.getParams(0);
  },

  getPort: function() {
    return this.getParams(1);
  },

  getToken: function() {
    return this.getParams(2);
  },

  normalizeParams: function() {
    return {
      info_hash : this.getInfoHash(),
      port      : this.getPort(),
      token     : this.getToken(),
    };
  },

  handleNormalizedParams: function(params) {
    if (typeof params.info_hash !== 'string' ||
        !globals.REGEX_NODE_ID.test(params.info_hash)) {
      return this.reject(new Error('non valid info_hash'));
    } else {
      this.params = [
        params.info_hash,
        params.port,
        params.token
      ];
    }
  },

  normalizeResult: function() {
    return {};
  },

  handleNormalizedResult: function(result) {
    this.resolve();
  }

});