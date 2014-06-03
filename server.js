/**
 * a simple chat server impl by socket.io-pre4
 * 
 * Copyright (C) 2014 guanglin.an (lucky315.an@gmail.com)
 */

"use strict";

var express = require('express');
var debug = require('debug')('chat:server');
var config = require('./config');
var port = config.dev.port;

var jsmask = require('json-mask');

var app = exports.app = express();
var http = require('http');
var httpServer = exports.httpServer = http.createServer(app);

var redis = require('redis');
var redisAdapter = require('socket.io-redis'); 

var io = exports.io = 
  require('socket.io')(
    httpServer, 
    { 
      key : 'wkrldi',
      transports : ['websocket'],
      adapter: redisAdapter(
        {
          host : 'localhost',
          port : 6379
        })
    });

//global consts
var myroom = 'baywalk';
var users = exports.users = {};
var nUsers = exports.nUsers = 0;

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){
  res.send('Hello World');
});

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(port, function(){
    process.send('Chatting server is listening port on ' + port);
  });
}

io.use(function(socket, next){
  var socket_req_field = 'headers(host),url,method,_query';
  var handshakeData = socket.request;
  // debug('Messages from HandshakeData:\n', jsmask(handshakeData, socket_req_field));

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
  debug('' ,
    ' New client is connected...' + 
    ' [id]: ' + socket.id + 
    ' [nsp]: ' , socket.nsp.name);

  socket.on('message', function(msg){
    debug('user: ' + socket.id + ' recv msg: ' + msg);
  });
  
  socket.on('join room', function(room, cb){
    debug('user: ' + socket.id + ' Join Room....:' + room);
    socket.join(room, cb);
  });

  socket.on('leave room', function(room, cb){
    debug('user: ' + socket.id + ' Leave Room....:' + room);
    socket.leave(room, cb);
  });

  socket.on('broadcast room', function(msg, room_name){
    broadcast_socket(socket, msg, room_name);
  });

  socket.on('disconnect', function(){
    debug('A client disconnected...');
  });

  // ytx ping pong
  socket.on('ask', function(msg){
    socket.emit('answer', msg);
  })

});

io.of('/user').on('connection', function(socket){
  
  var io_socket_field = 'rooms,id';
  debug(JSON.stringify(jsmask(socket, io_socket_field)));

  socket.on('add', function(username, cb){
    if(!socket.username) {
      nUsers++;
      socket.username = username;
      return cb && cb(null, '[user]:' +  username + ' add success');
    }
    cb && cb('user added');
  });

  socket.on('broadcast namespace', function(msg, ns){
    broadcast_namespace(msg, ns);
  });

  socket.on('new message', function(data){
    broadcast_namespace(data);
  });  
});

io.of('/private').on('connection', function(socket){
  debug(socket.nsp.name + ' a client is connected!');
  debug('[uuid] ', socket.request.uuid);

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

function broadcast_namespace(data, ns){
  if (ns) {
    debug('broadcasting namespace .... ' + ns);
    return io.of(ns).emit('new message', data);
  }

  Object.keys(io.nsps).forEach(function(key){
    debug('iter broadcasting namespace .... ' + key);
    io.of(key).emit('new message', data);
  });
}

function broadcast_socket(socket, data, room){
  if (!room)
    return socket.broadcast.emit('new message', data);

  debug('[broadcast2] [rooooooms] ', socket.rooms);
  debug('[broadcast2] ['+ room +']......')
  socket.broadcast.to(room).emit('new message', data);
}