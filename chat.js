/**
 * simple chatting room
 * Copyright (C) 2014 guanglin.an (lucky315.an@gmail.com)
 * 
 */

"use strict";

var cluster = require('cluster');
var nCpus = require('os').cpus().length;
var debug = require('debug')('chat:chat');

cluster.setupMaster({
  exec : "server.js",
  // args : ["--use", "https"],
  // silent : true
});

for(var i = 0; i < nCpus; ++i){
  cluster.fork();
}

Object.keys(cluster.workers).forEach(function(id){
  cluster.workers[id].on('message', function(msg){
    debug('worker %d : %s', id, msg);
  });
});
