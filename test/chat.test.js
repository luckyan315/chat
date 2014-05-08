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
 var async = require('async');

 var debug = require('debug')('Chat:ServerTest');
 var _ = require('lodash');

 var chat = require('../chat.js');
 var app = chat.app;
 var sio = chat.io;
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
    //sio.sockets -> the sio.of('/')
    sio.sockets.sockets.forEach(function(socket){
      debug(socket.id + ' is going to leaving all rooms');
      socket.leaveAll();
    });

    //clean namespaces sessions
    _.forEach(sio.nsps, function(nsp){
      if (nsp.name === '/') return;

      nsp.sockets.forEach(function(socket){
        debug(socket.id + ' is going to be disconnected by sio...');
        socket.disconnect(true);
      });
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
    var mgr = ioc.Manager(address + '/user');
    var user_socket = mgr.socket('/user');
    user_socket.on('connect', function(){
      done();
    });
  });

  it('should reconnect by default', function(done){
    // var socket = ioc(address);
    var socket = ioc(address, { reconnection: true , timeout: 20 });
    //socket.io --> manager
    socket.io.engine.close();
    socket.io.on('reconnect', function() {
      done();
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
    var bEmitted = false;
    
    user_socket.on('connect', function(){
      if(bEmitted) return;
      user_socket.emit('add', 'angl', function(err, data){
        bEmitted = true;
        if (err) throw new Error(err);
        debug('--------------------', data);
        //emit once more
        return user_socket.emit('add', 'angl', function(err, data){
          if (err) {
            debug('', 'xxxxxxxxxxxxxxxxxxxxx', err, data);
            return done();
          }
        });
        
      });
    })
  });

  it('should sio broadcast specified namespace sockets', function(done){
    var user1_socket = ioc(address + '/user', { multiplex: false });
    var user2_socket = ioc(address + '/user', { multiplex: false });
    var pri_socket = ioc(address + '/private', { multiplex: false });
    var nRecv = 0;
    var nExp = 2;
    var bEmitted = false;

    pri_socket.on('new message', function(data){
      done(new Error('/private should not recv msg!! ' + data));
    });

    user2_socket.on('new message', function(data){
      nRecv++;

      debug('', '[ioc] [user2] recv msg nRecv: ' + nRecv);
      if (nRecv === nExp) done();
    });

    user1_socket.on('new message', function(data){
      nRecv++;

      debug('', '[ioc] [user1] recv msg nRecv: ' + nRecv);
      if (nRecv === nExp) done();
    });

    sio.of('/user').on('connection', function(socket){
      if (bEmitted) return;
      debug('', 'a client connectted ...id: ' + socket.id);

      // client another namespace braodcasting....
      // in this case, other namespaces should not recv any msg.
      // pri_socket.emit('broadcast namespace', 'this is in /private ns, hi all in /user', '/user');

      // client broadcast by self namespace      
      user1_socket.emit('broadcast namespace', 'this is a client in /user ns, hi all in ns:' + ' /user', '/user');

      bEmitted = true;
    });
  });

it('should sio broadcast all namespace ok', function(done){
  var user_socket = ioc(address + '/user', { multiplex: false });
  var pri_socket = ioc(address + '/private', { multiplex: false });
  var nRecv = 0;
    var nExp = 2; // expect result

    pri_socket.on('new message', function(data){
      nRecv++;

      debug('', '[ioc] recv msg nRecv: ' + nRecv);
      if(nRecv === nExp) done();
    });

    user_socket.on('new message', function(data){
      nRecv++;

      debug('', '[ioc] recv msg nRecv: ' + nRecv);
      if(nRecv === nExp) done();
    });

    sio.of('/user').on('connection', function(socket){
      user_socket.emit('broadcast namespace', 'hi all namespace');
    });

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
    user3.emit('broadcast room', 'hi all room', room_name);
  });

});

it('should sio sockets broadcast multi-room', function(done){
  var user1 = ioc(address, { multiplex: false });
  var user2 = ioc(address, { multiplex: false });
  var user3 = ioc(address, { multiplex: false });
  var user4 = ioc(address, { multiplex: false });
  var nRecv = 0;
    var nExp = 3; //expect result

    user1.on('new message', function(data){
      debug('[user1] recv msg: ' + data);
      nRecv++;
      if (nRecv === nExp) done();
    });

    user2.on('new message', function(data){
      debug('[user2] recv msg: ' + data);
      nRecv++;
      if (nRecv === nExp) done();
    });

    user3.on('new message', function(data){
      debug('[user3] recv msg: ' + data);
      done(new Error('Should not recv msg by self'));
    });

    // Not join a specified room, just default room
    // should also recv the broadcast msg
    user4.on('new message', function(data){
      debug('[user4] recv msg: ' + data);
      nRecv++;
      if (nRecv === nExp) done();
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
      var sids = sio.sockets.adapter.sids;
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

it('should add multi users', function(done) {
  var user1 = ioc(address + '/user', { multiplex: false });
  var user2 = ioc(address + '/user', { multiplex: false });
  var user3 = ioc(address + '/user', { multiplex: false });
  var bEmitted = false;

  sio.of('/user').on('connection', function(){
    if (bEmitted) return;
    async.series({
      one: function(cb){
        user1.emit('add', 'user1', function(err, data){
          bEmitted = true;
          cb(err, data);
        });
      },
      two: function(cb){
        user2.emit('add', 'user2', function(err, data){
          cb(err, data);
        });
      },
      three: function(cb){
        user3.emit('add', 'user3', function(err, data){
          cb(err, data);
        });
      }
    }, function(err, result){
      if(!err) done();
    });      
  });


});

});
