var kadoh     = require('kadoh'),
    RPC       = kadoh.network.rpc.RPC,
    globals   = kadoh.globals,
    PeerArray = kadoh.util.PeerArray;

var GetPeers = module.exports = RPC.extend({

  initialize: function(queried, info_hash, token) {
    if (arguments.length === 0) {
      this.supr();
    } else {
      this.supr(queried, 'GET_PEERS', [info_hash]);
    }
  },

  getInfoHash: function() {
    return this.getParams(0);
  },

  normalizeParams: function() {
    return {
      info_hash : this.getInfoHash()
    };
  },

  handleNormalizedParams: function(params) {
    if (typeof params.info_hash !== 'string' ||
        !globals.REGEX_NODE_ID.test(params.info_hash)) {
      this.reject(new Error('non valid findvalue query'));
    } else {
      this.params = [params.info_hash];
    }
    return this;
  },

  normalizeResult: function() {
    var args   = this.getResult(),
        nodes  = args[0].getTripleArray(),
        values = args[1],
        token  = args[2];
    if (result) {
      return {
        nodes  : nodes,
        values : values,
        token  : token
      };
    } else {
      return {
        nodes : nodes,
        token : token
      };
    }
  },

  handleNormalizedResult: function(result) {
    var nodes, token, values = null;
    if (!result.nodes && !result.values) {
      return this.reject(new Error('non valid get_peers response'));
    }

    if (result.nodes) {
      try {
        nodes = new PeerArray(result.nodes);
      } catch (e) {
        this.reject(new Error('non valid get_peers response'));
        return;
      }
    }

    if (result.values && Array.isArray(result.values)) {
      values = result.values;
    }

    token = result.token || null;

    this.resolve(nodes, values, result.token);
  }

});