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
  debug('[address]: ' + address);
  
  beforeEach(function(done){
    httpServer.listen(port, function(err, result){
      if (err) debug(err);
      done(err);
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

      pri_socket.on('new_message', function(data){
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

      user_socket.on('new_message', function(data){
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
      user_socket.emit('sayall', 'hi');
    };
  });

  
});
