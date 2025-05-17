import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayInit,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Socket, Server } from 'socket.io';

export enum UserStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
}

export interface UserPresence {
  userId: string;
  socketId: string;
  status: UserStatus;
  lastActivity: Date;
}

export interface MessageComment {
  commentId: string;
  messageId: string;
  userId: string;
  text: string;
  timestamp: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MessagingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('MessagingGateway');
  private connectedUsers: Map<string, string> = new Map();
  private userReactions: Map<string, Map<string, string>> = new Map();
  private userPresence: Map<string, UserPresence> = new Map();
  private messageComments: Map<string, MessageComment[]> = new Map();

  afterInit() {
    this.logger.log('WebSocket Gateway Initialized');
  }

  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;

    if (!userId) {
      this.logger.error('Connection attempt without userId. Disconnecting.');
      client.emit('error', 'User ID is required for connection.');
      client.disconnect();
      return;
    }

    this.logger.log(`Client connected: ${client.id} - Username: ${userId}`);
    this.connectedUsers.set(userId, client.id);

    if (!this.userReactions.has(userId)) {
      this.userReactions.set(userId, new Map());
    }

    const presenceData: UserPresence = {
      userId,
      socketId: client.id,
      status: UserStatus.ONLINE,
      lastActivity: new Date(),
    };
    this.userPresence.set(userId, presenceData);

    this.server.emit('userPresenceUpdate', presenceData);

    const onlineUsers = Array.from(this.userPresence.values());
    client.emit('userPresenceList', onlineUsers);

    client.emit('connection_success', { clientId: client.id, userId });

    if (!this.messageComments.has(userId)) {
      this.messageComments.set(userId, []);
    }
  }

  handleDisconnect(client: Socket) {
    let disconnectedUserId: string | undefined;
    for (const [uid, sid] of this.connectedUsers.entries()) {
      if (sid === client.id) {
        disconnectedUserId = uid;
        break;
      }
    }

    if (disconnectedUserId) {
      this.connectedUsers.delete(disconnectedUserId);

      if (this.userPresence.has(disconnectedUserId)) {
        const presenceData = this.userPresence.get(disconnectedUserId)!;
        presenceData.status = UserStatus.OFFLINE;
        presenceData.lastActivity = new Date();
        this.server.emit('userPresenceUpdate', presenceData);
      }

      this.logger.log(
        `Client disconnected: ${client.id} - UserID: ${disconnectedUserId}`,
      );
    } else {
      this.logger.log(
        `Client disconnected: ${client.id} - UserID not found in mapping.`,
      );
    }
  }

  @SubscribeMessage('sendMessage')
  handleMessage(
    client: Socket,
    payload: {
      senderUserId: string;
      message: string;
      room?: string;
    },
  ): void {
    const senderSocketId = client.id;
    const userId = client.handshake.query.userId as string;

    let actualSenderUserId: string | undefined;
    for (const [uid, sid] of this.connectedUsers.entries()) {
      if (sid === senderSocketId) {
        actualSenderUserId = uid;
        break;
      }
    }

    if (!actualSenderUserId) {
      client.emit('error', 'Could not identify sender. Message not sent.');
      return;
    }

    const messagePayload = {
      ...payload,
      senderUserId: actualSenderUserId,
      timestamp: new Date(),
      messageId:
        Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
    };

    this.logger.log(
      `Message from UserID ${actualSenderUserId} (${senderSocketId}): ${payload.message}`,
    );

    if (payload.room) {
      this.server.to(payload.room).emit('receiveMessage', messagePayload);
    } else {
      this.server.emit('receiveMessage', messagePayload);
    }
  }

  @SubscribeMessage('getUserPresence')
  handleGetUserPresence(client: Socket, userId: string): void {
    if (this.userPresence.has(userId)) {
      client.emit('userPresenceInfo', this.userPresence.get(userId));
    } else {
      client.emit('error', `User ${userId} not found.`);
    }
  }

  @SubscribeMessage('getAllUserPresence')
  handleGetAllUserPresence(client: Socket): void {
    const allPresence = Array.from(this.userPresence.values());
    client.emit('userPresenceList', allPresence);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(client: Socket, room: string): void {
    const userId = client.handshake.query.userId as string;
    client.join(room);
    this.logger.log(
      `Client ${client.id} (UserID: ${userId}) joined room: ${room}`,
    );
    client.emit('joinedRoom', room);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(client: Socket, room: string): void {
    const userId = client.handshake.query.userId as string;
    client.leave(room);
    this.logger.log(
      `Client ${client.id} (UserID: ${userId}) left room: ${room}`,
    );
    client.emit('leftRoom', room);
  }

  @SubscribeMessage('reactToMessage')
  handleReaction(
    client: Socket,
    payload: { messageId: string; reaction: string },
  ): void {
    const userId = client.handshake.query.userId as string;

    if (!userId) {
      client.emit('error', 'User ID is required to react to messages.');
      return;
    }

    const { messageId, reaction } = payload;

    const userReactionMap = this.userReactions.get(userId);
    if (userReactionMap) {
      const existingReaction = userReactionMap.get(messageId);
      if (existingReaction && existingReaction !== reaction) {
        this.server.emit('reactionRemoved', {
          messageId,
          userId,
          reaction: existingReaction,
        });
      }

      userReactionMap.set(messageId, reaction);
    }

    this.server.emit('messageReaction', { messageId, userId, reaction });
  }

  @SubscribeMessage('removeReaction')
  handleRemoveReaction(
    client: Socket,
    payload: { messageId: string; reaction: string },
  ): void {
    const userId = client.handshake.query.userId as string;

    if (!userId) {
      client.emit('error', 'User ID is required to remove reactions.');
      return;
    }

    const { messageId, reaction } = payload;

    const userReactionMap = this.userReactions.get(userId);
    if (userReactionMap) {
      userReactionMap.delete(messageId);
    }

    this.server.emit('reactionRemoved', { messageId, userId, reaction });
  }

  @SubscribeMessage('getComments')
  handleGetComments(client: Socket, payload: { messageId: string }) {
    const comments = this.messageComments.get(payload.messageId) || [];
    client.emit('commentsList', {
      messageId: payload.messageId,
      comments: comments,
    });
  }

  @SubscribeMessage('addComment')
  handleAddComment(
    client: Socket,
    payload: { messageId: string; text: string },
  ) {
    const userId = client.handshake.query.userId as string;

    if (!userId) {
      client.emit('error', 'User ID is required to add comments.');
      return;
    }

    if (!payload.messageId || !payload.text) {
      client.emit('error', 'Message ID and text are required for comments.');
      return;
    }

    const comment: MessageComment = {
      commentId:
        Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
      messageId: payload.messageId,
      userId,
      text: payload.text,
      timestamp: new Date(),
    };

    if (!this.messageComments.has(payload.messageId)) {
      this.messageComments.set(payload.messageId, []);
    }

    this.messageComments.get(payload.messageId)?.push(comment);
    this.server.emit('commentAdded', comment);
  }
}
