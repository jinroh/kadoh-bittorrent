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
          rpc.resolve(nodes, values);
        }, function() {
          rpc.resolve(nodes, null);
        });
  },

  handleANNOUNCE_PEER: function(rpc) {
    var key = rpc.getInfoHash();
    var store = this.store;
    var ip = rpc.getQuerying().getAddress().split(':')[0];
    var port = rpc.getPort();
    var changed = true;
    store.retrieve(key)
        .pipe(function(values) {
          for (var i = 0, l = values.length; i < l; i++) {
            if (values[i][0] === ip &&
                values[i][1] === port)
              changed = false;
              return values;
          }
          values.push([ip, port]);
          return values;
        }, function() {
          return [[ip, port]];
        })
        .pipe(function(values) {
          if (changed)
            return store.save(key, value, -1);
        })
        .then(rpc.resolve, rpc.reject, rpc);
  },

  iterativeFindValue: function(key) {
    if (!globals.REGEX_NODE_ID.test(key)) {
      throw new TypeError('non valid key');
    }

    var send    = this.send(),
        close   = this._routingTable.getClosePeers(key, globals.K),
        seen    = new XORSortedPeerArray(close, key),
        lookup  = new IterativeDeferred(close),
        init    = [];

    function map(peer) {
      var rpc = new GetPeers(peer, key);
      send(rpc);
      return rpc;
    }

    function reduce(results, nodes, result, token, map) {
      if (!nodes) { return results; }
      seen.add(nodes);
      var newClosest = seen.newClosestIndex();
      if(newClosest >= 0 && newClosest < globals.ALPHA) {
        seen.first(globals.ALPHA, map);
      }
      if (result && result.length > 0) {
        for (var i = 0, l = result.length; i < l; i++) {
          if (results.indexOf(result[i]) === -1)
            results.push(result[i]);
        }
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

    // -- UI HACK
    lookup._target = key;
    this.emit('iterativeFindValue', lookup, close);

    return lookup
      .map(map)
      .reduce(reduce, init)
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
      var targets = peers.first(globals.K);
      var rpcs = targets.map(function(peer) {
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
