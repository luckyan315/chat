chat
====

a simple chatting room via latest socket.io(1.0.2)

sio & ioc 0.9.* VS pre4
====
## pre2 -> pre4

## pre1 -> pre2
1.    
    Allows user-level query string parameters to be in socket.request
    
    Uses the full url string rather than parsed.href;
    
    Also relies on a PR in engine.io

## 0.9.* -> pre1
1. Reconnects in open if it fails
2. enable reconnection by default (timeout=20000 by default) 
3. Add/binary support
4. zuul: add iphone and a few other chromes
