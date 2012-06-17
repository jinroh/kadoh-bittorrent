var kadoh = require('kadoh');
var BittorrentNode = require('./lib/bittorrent-node');

process.env.KADOH_TRANSPORT = 'udp';
var torrent = new BittorrentNode(null, {
  bootstraps: ['67.215.242.139:6881', '67.215.242.138:6881'],
  reactor : {
    type: 'udp',
    protocol: 'mainline',
    transport: {
      port: 6161
    }
  }
});

console.log("Connecting...");
torrent.connect(function() {
  console.log("Joining...");
  torrent.join(function() {
    require('repl').start('> ').context.torrent = torrent;
  });
});
