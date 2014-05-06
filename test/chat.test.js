/**
 * TDD sample code for testing chat.js
 * Copyright (C) 2014 guanglin.an (lucky315.an@gmail.com)
 * 
 */

"use strict";

var should = require('should');
var request = require('supertest');
var http = require('http');
var ioc = require('socket.io-client');

var debug = require('debug')('Chat:ServerTest');
var _ = require('lodash');

var chat = require('../chat.js');
var app = chat.app;
var io = chat.io;
var httpServer = chat.httpServer;

var config = require('../config');
var host = config.test.host;
var port = config.test.port;

describe('Chat Server', function(){
  var server = null;
  var address = 'ws://' + host + ':' + port;
  var room_name = 'baywalk';

  debug('[address]: ' + address);
  
  beforeEach(function(done){
    httpServer.listen(port, function(err, result){
      if (err) debug(err);
      done(err);
    });
  });

  afterEach(function(){
    //io.sockets -> the io.of('/')
    io.sockets.sockets.forEach(function(socket){
      debug(socket.id + ' is going to leaving all rooms');

      socket.leaveAll();
    });
  });
  
  it('should got 200 status code when visit get /', function(done){
    request(app)
      .get('/')
      .expect(200, done);
  });

  it('should work as a static server', function(done){
    request(app)
      .get('/index.html')
      .expect(200, done);
  });

  it('should "Not Found(404)"if there is not static file', function(done){
    request(app)
      .get('/xxx.html')
      .expect(404)
      .end(function(err, res){
        done();
      });
  });
  
  it('should connect the server success', function(done){
        var sockets = ioc(address);
    sockets.on('connect', function(client){
      io.eio.clientsCount.should.eql(1);
      done();
    });

    sockets.on('error', function(err){
      debug('[Error] ' , err);
      done(err);
    });
  });

  it('should access /private ', function(done){
        var pri_socket = ioc(address + '/private', { multiplex: false });

    pri_socket.on('connect', function(){
      debug('successfully established a connection with the namespace');
      done();
    });

    pri_socket.on('connect_failed', function(reason){
      debug('Unable to connect the namespace ', reason);
      done(reason);
    });
  });

  it('should do add action via /user namespace', function(done){
    var user_socket = ioc(address + '/user', {multiplex: false});

    user_socket.on('user_added', function(){
      done();
    });

    user_socket.on('connect', function(){
      user_socket.emit('add');      
    })
  });

  it('should sio namespace broadcast ok', function(done){
    var user_socket = ioc(address + '/user', { multiplex: false });
    var pri_socket = ioc(address + '/private', { multiplex: false });
    var nRecvCnt = 0;
    var nConn = 0;

    pri_socket.on('connect', function(){
      nConn++;

      pri_socket.on('new message', function(data){
        if(data === 'hi') nRecvCnt++;
        debug('', '[ioc] recv msg nRecvCnt: ' + nRecvCnt);

        if(nRecvCnt === 2){
          done();
        }
      });

      if(nConn === 2) user_ns_send();
    });

    user_socket.on('connect', function(){
      nConn++;

      user_socket.on('new message', function(data){
        if(data === 'hi') nRecvCnt++;
        debug('', '[ioc] recv msg nRecvCnt: ' + nRecvCnt);

        if(nRecvCnt === 2){
          done();
        }
      });

      if (nConn === 2) user_ns_send();
    });

    function user_ns_send(){
      debug('', 'client emit sayall hi');
      user_socket.emit('new message', 'hi');
    };
  });

  it('should sio sockets broadcast a specified room ok', function(done){
    var user1 = ioc(address, { multiplex: false });
    var user2 = ioc(address, { multiplex: false });
    var user3 = ioc(address, { multiplex: false });
    var nRecv = 0;

    user1.on('new message', function(data){
      debug('[user1] recv msg: ' + data);
      nRecv++;
      if (nRecv === 2) done();
    });

    user2.on('new message', function(data){
      debug('[user2] recv msg: ' + data);
      nRecv++;
      if (nRecv === 2) done();      
    });

    user3.on('new message', function(data){
      debug('[user3] recv msg: ' + data);
      done(new Error('Should not recv msg by self'));
    });


    user1.emit('join room', room_name);
    user2.emit('join room', room_name);
    user3.emit('join room', room_name, function(){
      user3.emit('broadcast room', 'hi all', room_name);
    });

  });

  it('should sio sockets broadcast multi-room', function(done){
    var user1 = ioc(address, { multiplex: false });
    var user2 = ioc(address, { multiplex: false });
    var user3 = ioc(address, { multiplex: false });
    var nRecv = 0;

    user1.on('new message', function(data){
      debug('[user1] recv msg: ' + data);
      nRecv++;
      if (nRecv === 2) done();
    });

    user2.on('new message', function(data){
      debug('[user2] recv msg: ' + data);
      nRecv++;
      if (nRecv === 2) done();
    });

    user3.on('new message', function(data){
      debug('[user3] recv msg: ' + data);
      done(new Error('Should not recv msg by self'));
    });
  
    user1.emit('join room', 'room1');
    user2.emit('join room', 'room2');
    user3.emit('join room', 'room3', function(){
      user3.emit('broadcast room', 'hi all');
    });

  })

  it('should add/leave room ok', function(done){
    var user1 = ioc(address, { multiplex: false });
    var user2 = ioc(address, { multiplex: false });
    var user3 = ioc(address, { multiplex: false });
    var nUsers = 0;
    
    user1.emit('join room', room_name, function(){ nUsers++; if(nUsers === 3) user_leave();});
    user2.emit('join room', room_name, function(){ nUsers++; if(nUsers === 3) user_leave();});
    user3.emit('join room', room_name, function(){ nUsers++; if(nUsers === 3) user_leave();});

    function user_leave(){
      debug('one user leaving the room....' + room_name);

      user1.emit('leave room', room_name, function(){
        --nUsers;
            var sids = io.sockets.adapter.sids;
        debug('[adapter.sids]: ', sids);

            var nLeftRoom = _.reduce(sids, function(result, num, key){
              // debug('[ sids[key] ]', sids[key]);
              if(sids[key][room_name] === true) result++;

              // debug('[ result ]: ', result);
              return result;
            }, 0);
        
        debug('[nLeftRoom]: ' + nLeftRoom + ' [nUsers]: ' + nUsers);
        if (nLeftRoom === nUsers) done();
      });
    }
  });
});
