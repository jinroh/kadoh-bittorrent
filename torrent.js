process.env.KADOH_TRANSPORT = 'udp';

var kadoh = require('kadoh');
    url = require('url');
    bittorrent = require('./lib/bittorrent-node');

var shaReg = /[A-Za-z0-9]{40}/

var node = new bittorrent(null, {
  bootstraps: ['67.215.242.139:6881', '67.215.242.138:6881'],
  reactor : {
    type: 'udp',
    protocol: 'mainline',
    transport: {
      port: 6161
    }
  }
});

function parseMagnetLink(uri) {
  if (shaReg.test(uri)) {
    return uri;
  }
  var magnet = url.parse(uri, true).query.xt.split(':');
  if (magnet[0] == "urn" &&
      magnet[1] == "btih" &&
      shaReg.test(magnet[2]))
    return magnet[2];
  else
    throw new Error("Wrong Magnet URI");
}

console.log("Connecting...");
node.connect(function() {
  console.log("Joining...");
  node.join(function() {
    console.log('Try torrent.get("#info_hash")');
    require('repl').start('torrent> ').context.torrent = {
      node: node,
      get: function(hash) {
        node.get(parseMagnetLink(hash), function(arr) { console.log(arr); })
      },
      announce: function() {
        
      }
    }
  });
});
