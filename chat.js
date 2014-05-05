/**
 * simple chatting room
 * Copyright (C) 2014 guanglin.an (lucky315.an@gmail.com)
 * 
 */

 "use strict";

 var express = require('express');
 var debug = require('debug')('Chat:app');
 var config = require('./config');
 var port = config.dev.port;

 var jsmask = require('json-mask');

 var app = exports.app = express();
 var http = require('http');
 var httpServer = exports.httpServer = http.createServer(app);

 var redis = require('redis');
 var pub = redis.createClient();
 var sub = redis.createClient(null, null, {detect_buffers: true});
 var redisAdapter = require('socket.io-redis'); 

 var redisClients = [];
 var io = exports.io = 
 require('socket.io')(httpServer, { adapter: redisAdapter({ pubClient: pub, subclient: sub }) });
 redisClients.push(pub, sub);

 var room = 'baywalk';

 app.use(express.static(__dirname + '/public'));

 app.get('/', function(req, res){
  res.send('Hello World');
});

 if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(port, function(){
    debug('Chatting server is listening port on %d', port);
  });
}

io.use(function(socket, next){
  var socket_req_field = 'headers(host),url,method,_query';
  var handshakeData = socket.request;
  debug('Messages from HandshakeData:\n', jsmask(handshakeData, socket_req_field));

  // do some authorization...
  if(!handshakeData.uuid){
    handshakeData.uuid = 'wkrldi';
  }
  next();

  // check cookie, as use express
  // if (handshakeData.headers.cookie) return next();
  // next(new Error('Authorization Error'));
});

io.on('connection', function(socket) {
  debug('New client is connected...');

  socket.on('disconnect', function(){
    debug('A client disconnected...');
  });
});

io.of('/user').on('connection', function(socket){
  socket.join(room);

  var io_socket_field = 'rooms,id';
  debug(JSON.stringify(jsmask(socket, io_socket_field)));
  
  // todo: public user api
  socket.on('add', function(){
    socket.emit('user_added');
  });

  //for testt
  socket.on('sayall', function(data){
    debug('' , '[Chat][sayall] ' + data);

    //broadcast via namespaces
    Object.keys(io.nsps).forEach(function(key){
      io.of(key).emit('new_message', data);
    });
  });  
});

io.of('/private').on('connection', function(socket){
  debug(socket.nsp.name + ' a client is connected!');
  debug('[uuid] ', socket.request.uuid);
  socket.join(room);

  var io_socket_field = 'rooms,id';
  debug(JSON.stringify(jsmask(socket, io_socket_field)));
  
  //todo: private api
  
});

io.on('error', function(err){
  debug('[socket.io][error] ', err);
});

process.on('uncaughtException', function(err) {
  debug(err);
  debug(err.stack);
  throw err;
});

