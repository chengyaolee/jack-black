/**
 * Jack Black - WebRTC Peer-to-Peer Multiplayer Engine
 * Uses PeerJS (over WebRTC DataChannels) with zero backend servers required.
 * Fully end-to-end encrypted (DTLS) and runs 100% on GitHub Pages.
 */

export class MultiplayerEngine {
  constructor(options = {}) {
    this.role = 'SOLO'; // 'SOLO', 'HOST', 'CLIENT'
    this.roomCode = null;
    this.peer = null;
    this.hostConnection = null; // Used by CLIENT to talk to HOST
    this.clientConnections = new Map(); // Used by HOST: peerId -> DataConnection
    this.assignedSeatIndex = -1; // For CLIENT: which seat they control
    this.playerName = options.playerName || 'Player';
    this.playerAvatar = options.playerAvatar || '🤠';

    // Callbacks
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onRemoteAction = options.onRemoteAction || (() => {});
    this.onRemoteBet = options.onRemoteBet || (() => {});
    this.onRemoteInsurance = options.onRemoteInsurance || (() => {});
    this.onStateSync = options.onStateSync || (() => {});
    this.onPlayerJoined = options.onPlayerJoined || (() => {});
    this.onPlayerLeft = options.onPlayerLeft || (() => {});
    this.onReaction = options.onReaction || (() => {});
    this.onError = options.onError || (() => {});
  }

  isMultiplayer() {
    return this.role === 'HOST' || this.role === 'CLIENT';
  }

  isHost() {
    return this.role === 'HOST';
  }

  isClient() {
    return this.role === 'CLIENT';
  }

  generateRoomCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  getPeerIdForRoom(roomCode) {
    return `jackblack-v1-room-${roomCode.toUpperCase().trim()}`;
  }

  /**
   * Host starts a new multiplayer table
   */
  startHosting(roomCode = null, hostName = 'Host', hostAvatar = '😎') {
    this.disconnect();

    this.role = 'HOST';
    this.roomCode = (roomCode || this.generateRoomCode()).toUpperCase();
    this.playerName = hostName;
    this.playerAvatar = hostAvatar;
    this.clientConnections.clear();

    const hostPeerId = this.getPeerIdForRoom(this.roomCode);

    if (typeof window.Peer === 'undefined') {
      this.onError('PeerJS library not loaded. Please check your internet connection.');
      this.role = 'SOLO';
      return;
    }

    try {
      this.peer = new window.Peer(hostPeerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        this.onStatusChange({
          role: 'HOST',
          roomCode: this.roomCode,
          status: 'HOSTING',
          connectedPeers: 0
        });
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingClientConnection(conn);
      });

      this.peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          // Room code already taken; retry with a new code
          this.startHosting(this.generateRoomCode(), hostName, hostAvatar);
        } else {
          this.onError(`Host connection error: ${err.message || err.type}`);
        }
      });

      this.peer.on('disconnected', () => {
        if (this.peer && !this.peer.destroyed) {
          this.peer.reconnect();
        }
      });
    } catch (e) {
      this.onError(`Failed to create room: ${e.message}`);
      this.role = 'SOLO';
    }
  }

  handleIncomingClientConnection(conn) {
    conn.on('open', () => {
      this.clientConnections.set(conn.peer, conn);

      // Listen for messages from this client
      conn.on('data', (data) => {
        this.handleClientMessage(conn, data);
      });

      conn.on('close', () => {
        this.clientConnections.delete(conn.peer);
        this.onPlayerLeft({ peerId: conn.peer });
        this.onStatusChange({
          role: 'HOST',
          roomCode: this.roomCode,
          status: 'HOSTING',
          connectedPeers: this.clientConnections.size
        });
      });
    });

    conn.on('error', (err) => {
      this.clientConnections.delete(conn.peer);
    });
  }

  handleClientMessage(conn, msg) {
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'JOIN_REQUEST':
        this.onPlayerJoined({
          peerId: conn.peer,
          name: this.sanitize(msg.name || 'Player'),
          avatar: msg.avatar || '🤠',
          conn
        });
        break;

      case 'ACTION':
        this.onRemoteAction({
          peerId: conn.peer,
          action: msg.action // 'HIT', 'STAND', 'DOUBLE', 'SPLIT'
        });
        break;

      case 'BET':
        this.onRemoteBet({
          peerId: conn.peer,
          amount: parseInt(msg.amount, 10)
        });
        break;

      case 'INSURANCE':
        this.onRemoteInsurance({
          peerId: conn.peer,
          take: !!msg.take
        });
        break;

      case 'REACTION':
        this.onReaction({
          peerId: conn.peer,
          emoji: msg.emoji
        });
        // Broadcast reaction to all other clients
        this.broadcast({
          type: 'PEER_REACTION',
          peerId: conn.peer,
          emoji: msg.emoji
        });
        break;
    }
  }

  /**
   * Guest joins an existing room hosted by a friend
   */
  joinRoom(roomCode, playerName = 'Guest', playerAvatar = '🤠') {
    this.disconnect();

    this.role = 'CLIENT';
    this.roomCode = roomCode.toUpperCase().trim();
    this.playerName = playerName;
    this.playerAvatar = playerAvatar;

    if (typeof window.Peer === 'undefined') {
      this.onError('PeerJS library not loaded. Please check your internet connection.');
      this.role = 'SOLO';
      return;
    }

    try {
      this.peer = new window.Peer(null, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.peer.on('open', (myId) => {
        const hostPeerId = this.getPeerIdForRoom(this.roomCode);
        const conn = this.peer.connect(hostPeerId, {
          reliable: true
        });

        this.hostConnection = conn;

        conn.on('open', () => {
          // Send Join Request with player profile
          conn.send({
            type: 'JOIN_REQUEST',
            name: this.playerName,
            avatar: this.playerAvatar
          });

          this.onStatusChange({
            role: 'CLIENT',
            roomCode: this.roomCode,
            status: 'CONNECTED_AS_GUEST'
          });
        });

        conn.on('data', (data) => {
          this.handleHostMessage(data);
        });

        conn.on('close', () => {
          this.onError('Host closed the table or connection was lost.');
          this.disconnect();
        });

        conn.on('error', (err) => {
          this.onError(`Failed to connect to table ${this.roomCode}. Please verify the room code.`);
          this.disconnect();
        });
      });

      this.peer.on('error', (err) => {
        this.onError(`Multiplayer error: ${err.message || err.type}`);
        this.disconnect();
      });
    } catch (e) {
      this.onError(`Connection failed: ${e.message}`);
      this.disconnect();
    }
  }

  handleHostMessage(msg) {
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'WELCOME':
        this.assignedSeatIndex = msg.seatIndex;
        this.onStatusChange({
          role: 'CLIENT',
          roomCode: this.roomCode,
          status: 'CONNECTED_AS_GUEST',
          assignedSeatIndex: msg.seatIndex,
          tableName: msg.tableName || 'Vegas Table'
        });
        if (msg.initialState) {
          this.onStateSync(msg.initialState, this.assignedSeatIndex);
        }
        break;

      case 'STATE_SYNC':
        this.onStateSync(msg.state, this.assignedSeatIndex);
        break;

      case 'TABLE_MESSAGE':
        this.onError(msg.text);
        break;

      case 'PEER_REACTION':
        this.onReaction(msg);
        break;

      case 'ROOM_FULL':
        this.onError('This table is already full (max 5 players).');
        this.disconnect();
        break;
    }
  }

  // --- Host Outbound Broadcasts ---

  broadcast(message) {
    if (!this.isHost()) return;
    for (const [peerId, conn] of this.clientConnections.entries()) {
      if (conn && conn.open) {
        conn.send(message);
      }
    }
  }

  sendToClient(peerId, message) {
    if (!this.isHost()) return;
    const conn = this.clientConnections.get(peerId);
    if (conn && conn.open) {
      conn.send(message);
    }
  }

  broadcastState(state) {
    this.broadcast({
      type: 'STATE_SYNC',
      state
    });
  }

  // --- Client Outbound Messages ---

  sendAction(action) {
    if (this.isClient() && this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({
        type: 'ACTION',
        action
      });
    }
  }

  sendBet(amount) {
    if (this.isClient() && this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({
        type: 'BET',
        amount
      });
    }
  }

  sendInsurance(take) {
    if (this.isClient() && this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({
        type: 'INSURANCE',
        take
      });
    }
  }

  sendReaction(emoji) {
    if (this.isClient() && this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({
        type: 'REACTION',
        emoji
      });
    } else if (this.isHost()) {
      this.broadcast({
        type: 'PEER_REACTION',
        peerId: 'host',
        emoji
      });
    }
  }

  // --- Cleanup ---

  disconnect() {
    if (this.hostConnection) {
      try { this.hostConnection.close(); } catch (e) {}
      this.hostConnection = null;
    }

    if (this.clientConnections) {
      for (const [peerId, conn] of this.clientConnections.entries()) {
        try { conn.close(); } catch (e) {}
      }
      this.clientConnections.clear();
    }

    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }

    this.role = 'SOLO';
    this.roomCode = null;
    this.assignedSeatIndex = -1;

    this.onStatusChange({
      role: 'SOLO',
      status: 'SOLO'
    });
  }

  sanitize(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerText.slice(0, 15);
  }
}
