var kadoh = require('kadoh');

var KadNode            = kadoh.logic.KademliaNode,

    crypto             = kadoh.util.crypto,
    Deferred           = kadoh.util.Deferred,
    PeerArray          = kadoh.util.PeerArray,
    XORSortedPeerArray = kadoh.util.XORSortedPeerArray,
    IterativeDeferred  = kadoh.util.IterativeDeferred,

    globals            = kadoh.globals,

    FindValue          = kadoh.network.FindValue,
    GetPeers           = require('./rpc/get-peers'),
    AnnouncePeer       = require('./rpc/announce-peer');

var BittorrentNode = module.exports = KadNode.extend({

  initialize: function(id, options) {
    this.supr(id, options);
    this._reactor.register({
      ANNOUNCE_PEER : AnnouncePeer,
      GET_PEERS     : GetPeers
    });
  },

  get: function(info_hash, callback, context) {
    context = context || null;
    this.iterativeFindValue(info_hash)
        .then(function(peers) {
          callback.call(context, peers);
        }, function() {
          callback.call(context, null);
        })
  },

  handleGET_PEERS: function(rpc) {
    var nodes = this._routingTable.getClosePeers(rpc.getInfoHash(), globals.BETA, rpc.getQuerying());
    this._store.retrieve(rpc.getInfoHash())
        .then(function(values) {
          rpc.resolve(nodes, values, 'deadbeef');
        }, function() {
          rpc.resolve(nodes, null, 'deadbeef');
        });
  },

  handleANNOUNCE_PEER: function(rpc) {
    var key  = rpc.getInfoHash(),
        ip   = rpc.getQuerying().getAddress().split(':')[0],
        port = rpc.getPort();
    this._store.retrieve(key)
        .pipe(function(values) {
          if (values.every(function(val) { return (val[0] !== ip && val[1] !== port); })) {
            values.push([ip, port]);
            return this._store.save(key, value, -1);
          }
          return values;
        }, function() {
          return [[ip, port]];
        }, this)
        .then(rpc.resolve, rpc.reject, rpc);
  },

  iterativeFindValue: function(key) {
    if (!globals.REGEX_NODE_ID.test(key)) {
      throw new TypeError('non valid key');
    }

    var send   = this.send(),
        close  = this._routingTable.getClosePeers(key, globals.K),
        seen   = new XORSortedPeerArray(close, key),
        lookup = new IterativeDeferred(close);

    function map(peer) {
      return send(new GetPeers(peer, key));
    }

    function reduce(results, nodes, result, token, map) {
      if (nodes) {
        seen.add(nodes);
        var c = seen.newClosestIndex();
        if(c >= 0 && c < globals.ALPHA) {
          seen.first(globals.ALPHA, map);
        }
      }
      if (result) {
        result.forEach(function(addr) {
          if (results.indexOf(addr) !== -1) return;
          results.push(addr);
        });
        lookup.progress(results);
      }
      return results;
    }

    function end(results, map, reached) {
      reached = new XORSortedPeerArray(reached, key);
      if (results.length > 0) {
        lookup.resolve(results, reached);
      } else {
        lookup.reject(reached);
      }
    }

    this.emit('iterativeFindValue', lookup, close);

    return lookup
      .map(map)
      .reduce(reduce, [])
      .end(end);
  },

  iterativeAnnounce: function(key, port, exp) {
    if (!globals.REGEX_NODE_ID.test(key)) {
      throw new TypeError('non valid key');
    }

    function querieds(rpcs) {
      return new PeerArray(rpcs.map(function(rpc) {
        return rpc.getQueried();
      }));
    }

    var def = new Deferred(),
        send = this.send();

    var appends = function(peers) {
      var rpcs = peers.first(globals.K).map(function(peer) {
        return send(new AnnouncePeer(peer, key, port));
      });
      Deferred.whenAtLeast(rpcs, 1)
        .then(function(appended, notAppended) {
          def.resolve(key, querieds(appended), querieds(notAppended));
        }, function(appended, notAppended) {
          def.reject(querieds(notAppended));
        });
    };

    this.iterativeFindValue(key)
        .then(appends, function() { def.reject(new PeerArray()); });

    return def;
  }

});
