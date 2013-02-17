process.env.KADOH_TRANSPORT = 'udp';

var kadoh = require('kadoh');
    url = require('url');
    bittorrent = require('./lib/bittorrent-node');

var log = kadoh.logger.logging;

var shaReg = /[A-Za-z0-9]{40}/

var node = new bittorrent('099f9586173ba91c05c2781311ddfc22122ae75a', {
  bootstraps: ['67.215.242.139:6881', '67.215.242.138:6881'],
  reactor : {
    type: 'udp',
    protocol: 'mainline',
    transport: {
      port: 6161
    }
  }
});

new kadoh.logger.reporter.Console(log, 'debug');

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

node.connect(function() {
  node.join(function() {
    require('repl').start('torrent> ').context.torrent = {
      node: node,
      get: function(hash) {
        node.get(parseMagnetLink(hash), function(arr) { console.log(arr); })
      },
      announce: function() {}
    }
  });
});
