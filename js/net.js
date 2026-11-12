// Warpath 2026 — online multiplayer via PeerJS (WebRTC). De host draait de simulatie.
'use strict';
(function () {
const PREFIX = 'warpath2026-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// Eigen PeerJS-server gebruiken? Voeg ?peer=host:poort toe aan de URL (bijv. je Raspberry Pi).
const peerOpts = () => {
  const q = new URLSearchParams(location.search).get('peer');
  const dbg = +(new URLSearchParams(location.search).get('pdebug') || 0);
  if (!q) return { debug: dbg };
  const [host, port] = q.split(':');
  const extra = new URLSearchParams(location.search).get('ice') === 'none' ? { config: { iceServers: [] } } : {};
  return { ...extra, debug: dbg, host, port: +(port || 9000), path: '/', secure: location.protocol === 'https:' && host !== 'localhost' };
};
const makeCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

class Net {
  constructor() { this.peer = null; this.conns = new Map(); this.host = false; this.code = null; this.handlers = {}; this.myId = null; }
  on(ev, fn) { this.handlers[ev] = fn; }
  emit(ev, ...a) { this.handlers[ev] && this.handlers[ev](...a); }

  hostGame() {
    return new Promise((resolve, reject) => {
      this.host = true; this.code = makeCode();
      if (typeof Peer === 'undefined') return reject(new Error('PeerJS niet geladen (geen internet?)'));
      this.peer = new Peer(PREFIX + this.code, peerOpts());
      this.peer.on('open', id => { this.myId = 'host'; resolve(this.code); });
      this.peer.on('error', e => {
        if (e.type === 'unavailable-id') { this.peer.destroy(); this.hostGame().then(resolve, reject); return; }
        this.emit('error', e); reject(e);
      });
      this.peer.on('connection', conn => {
        conn.on('open', () => { const had = this.conns.has(conn.peer); this.conns.set(conn.peer, conn); if (!had) this.emit('join', conn.peer); });
        conn.on('data', d => { if (this.conns.get(conn.peer) !== conn) this.conns.set(conn.peer, conn); this.emit('msg', conn.peer, d); });
        const gone = () => { if (this.conns.get(conn.peer) === conn) { this.conns.delete(conn.peer); this.emit('leave', conn.peer); } };
        conn.on('close', gone); conn.on('error', gone);
      });
      this.peer.on('disconnected', () => { try { this.peer.reconnect(); } catch (e) {} });
    });
  }

  joinGame(code) {
    return new Promise((resolve, reject) => {
      this.host = false; this.code = code.toUpperCase().trim();
      if (typeof Peer === 'undefined') return reject(new Error('PeerJS niet geladen (geen internet?)'));
      this.peer = new Peer(peerOpts());
      let done = false;
      const to = setTimeout(() => { if (!done) { done = true; reject(new Error('Geen verbinding met spel ' + this.code + '. Klopt de code en is de host online?')); } }, 20000);
      this.peer.on('open', id => {
        this.myId = id;
        // Verbinden met automatische herpoging (soms gaat de eerste WebRTC-handshake verloren)
        let tries = 0;
        const attempt = () => {
          if (done) return;
          tries++;
          const conn = this.peer.connect(PREFIX + this.code);
          const retry = setTimeout(() => { if (!done && tries < 5) { try { conn.close(); } catch (e) {} attempt(); } }, 3500);
          conn.on('open', () => {
            if (done) return; done = true; clearTimeout(retry); clearTimeout(to);
            this.hostConn = conn;
            conn.on('data', d => this.emit('msg', 'host', d));
            conn.on('close', () => { if (this.hostConn === conn) this.emit('lost'); });
            conn.on('error', e => { if (this.hostConn === conn) this.emit('lost', e); });
            resolve(id);
          });
        };
        attempt();
      });
      this.peer.on('error', e => {
        if (!done) { clearTimeout(to); reject(new Error(e.type === 'peer-unavailable' ? 'Spel ' + this.code + ' niet gevonden.' : 'Netwerkfout: ' + e.type)); }
        else this.emit('error', e);
      });
    });
  }

  send(to, msg) { const c = this.conns.get(to); if (c && c.open) c.send(msg); }
  broadcast(msg) { for (const c of this.conns.values()) if (c.open) c.send(msg); }
  toHost(msg) { if (this.hostConn && this.hostConn.open) this.hostConn.send(msg); }
  close() { try { this.peer && this.peer.destroy(); } catch (e) {} this.conns.clear(); this.peer = null; this.hostConn = null; }
  inviteLink() { const u = new URL(location.href); const pq = new URLSearchParams(location.search).get('peer'); const iq = new URLSearchParams(location.search).get('ice'); u.search = '?join=' + this.code + (pq ? '&peer=' + pq : '') + (iq ? '&ice=' + iq : ''); u.hash = ''; return u.toString(); }
}
WP.Net = Net;
})();
