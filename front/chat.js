const UserStatus = {
  ONLINE: 'online',
  OFFLINE: 'offline',
};

let socket;
let currentRoom = null;
let currentUserId = null;
let userReactions = new Map();
let onlineUsers = new Map();
let selectedUserForProfile = null;
let currentMessageForComments = null;

// DOM Elements
const appContainer = document.querySelector('.app-container');
const userIdInput = document.getElementById('userId');
const connectButton = document.getElementById('connectButton');
const connectionStatus = document.getElementById('connectionStatus');
const onlineUsersList = document.getElementById('onlineUsersList');
const roomNameInput = document.getElementById('roomName');
const joinRoomButton = document.getElementById('joinRoomButton');
const currentRoomStatus = document.getElementById('currentRoomStatus');
const messageInputContainer = document.getElementById('messageInputContainer');
const messageInput = document.getElementById('messageInput');
const sendMessageButton = document.getElementById('sendMessageButton');
const messagesDiv = document.getElementById('messages');

// Modals
const emojiModal = document.getElementById('emojiModal');
const emojiList = document.getElementById('emojiList');
const closeEmojiModal = document.getElementById('closeEmojiModal');
const userProfileModal = document.getElementById('userProfileModal');
const profileInitials = document.getElementById('profileInitials');
const profileName = document.getElementById('profileName');
const profileStatus = document.getElementById('profileStatus');
const profileActivity = document.getElementById('profileActivity');
const closeProfileModal = document.getElementById('closeProfileModal');

// Comment Modal Elements
const commentModal = document.getElementById('commentModal');
const commentsList = document.getElementById('commentsList');
const commentInput = document.getElementById('commentInput');
const submitComment = document.getElementById('submitComment');
const closeCommentModal = document.getElementById('closeCommentModal');

let selectedMessageId = null;

// Helper Functions
function formatRelativeTime(date) {
  if (!date) return 'Unknown';

  const now = new Date();
  const diffMs = now - new Date(date);
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec} seconds ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2);
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// Online Users List
function updateOnlineUsersList() {
  onlineUsersList.innerHTML = '';

  if (onlineUsers.size === 0) {
    const noUsers = document.createElement('p');
    noUsers.textContent = 'No users online';
    noUsers.classList.add('status');
    noUsers.style.padding = '10px 15px';
    onlineUsersList.appendChild(noUsers);
    return;
  }

  const sortedUsers = Array.from(onlineUsers.values()).sort((a, b) => {
    return a.status === UserStatus.ONLINE ? -1 : 1;
  });

  sortedUsers.forEach((user) => {
    if (user.userId === currentUserId) return;

    const userItem = document.createElement('div');
    userItem.classList.add('user-item', `status-${user.status}`);
    userItem.dataset.userId = user.userId;

    const avatar = document.createElement('div');
    avatar.classList.add('user-avatar');
    avatar.textContent = getInitials(user.userId);

    const userInfo = document.createElement('div');
    userInfo.classList.add('user-info');

    const userName = document.createElement('div');
    userName.classList.add('user-name');
    userName.textContent = user.userId;

    const userStatus = document.createElement('div');
    userStatus.classList.add('user-status');
    userStatus.textContent = capitalizeFirstLetter(user.status);

    const lastActivity = document.createElement('div');
    lastActivity.classList.add('last-activity');
    lastActivity.textContent = `Active: ${formatRelativeTime(user.lastActivity)}`;

    userInfo.appendChild(userName);
    userInfo.appendChild(userStatus);
    userInfo.appendChild(lastActivity);

    userItem.appendChild(avatar);
    userItem.appendChild(userInfo);
    userItem.addEventListener('click', () => showUserProfile(user));
    onlineUsersList.appendChild(userItem);
  });
}

// User Profile
function showUserProfile(user) {
  selectedUserForProfile = user;
  profileInitials.textContent = getInitials(user.userId);
  profileName.textContent = user.userId;
  profileStatus.textContent = capitalizeFirstLetter(user.status);
  profileStatus.className = `status-indicator status-${user.status}`;
  profileActivity.textContent = `Last activity: ${formatRelativeTime(user.lastActivity)}`;
  userProfileModal.style.display = 'block';
}

// Message Handling
function addMessage(text, type = 'info', messageData = null) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message-container');

  if (messageData?.messageId) {
    messageElement.dataset.id = messageData.messageId;
  }

  const messageContent = document.createElement('div');
  messageContent.classList.add('message');

  if (type === 'error') {
    messageContent.classList.add('error');
    messageContent.textContent = text;
  } else if (type === 'status') {
    messageContent.classList.add('status');
    messageContent.textContent = text;
  } else if (messageData) {
    const messageHeader = document.createElement('div');
    messageHeader.classList.add('message-header');

    const senderSpan = document.createElement('span');
    senderSpan.classList.add('message-sender');
    senderSpan.textContent = messageData.senderUserId || 'Unknown';

    const roomSpan = document.createElement('span');
    roomSpan.classList.add('message-room');
    roomSpan.textContent = messageData.room
      ? `#${messageData.room}`
      : 'System Message';

    messageHeader.appendChild(senderSpan);
    messageHeader.appendChild(roomSpan);
    messageContent.appendChild(messageHeader);

    const textElement = document.createElement('div');
    textElement.classList.add('message-content');
    textElement.textContent = messageData.message;
    messageContent.appendChild(textElement);
  } else {
    messageContent.textContent = text;
  }

  messageElement.appendChild(messageContent);

  if (type !== 'status' && messageData?.messageId) {
    const actionsContainer = document.createElement('div');
    actionsContainer.classList.add('message-actions');

    // Comment Button
    const commentButton = document.createElement('button');
    commentButton.textContent = 'Comment';
    commentButton.classList.add('comment-button');
    commentButton.addEventListener('click', () =>
      openCommentModal(messageData.messageId),
    );
    actionsContainer.appendChild(commentButton);

    // Reaction Button
    const reactButton = document.createElement('button');
    reactButton.textContent = 'React';
    reactButton.classList.add('react-button');
    reactButton.addEventListener('click', () =>
      openEmojiModal(messageData.messageId),
    );
    actionsContainer.appendChild(reactButton);

    messageElement.appendChild(actionsContainer);
  }

  messagesDiv.appendChild(messageElement);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Comment Feature
function openCommentModal(messageId) {
  currentMessageForComments = messageId;
  commentsList.innerHTML = '';
  socket.emit('getComments', { messageId });
  commentModal.style.display = 'block';
  commentInput.focus();
}

function closeCommentModalHandler() {
  commentModal.style.display = 'none';
  currentMessageForComments = null;
}

function displayComment(commentData) {
  const commentElement = document.createElement('div');
  commentElement.classList.add('comment');

  const commentHeader = document.createElement('div');
  commentHeader.classList.add('comment-header');
  commentHeader.textContent = `${commentData.userId} - ${formatRelativeTime(commentData.timestamp)}`;

  const commentContent = document.createElement('div');
  commentContent.classList.add('comment-content');
  commentContent.textContent = commentData.text;

  commentElement.appendChild(commentHeader);
  commentElement.appendChild(commentContent);
  commentsList.appendChild(commentElement);
  commentsList.scrollTop = commentsList.scrollHeight;
}

// Emoji Reactions
function openEmojiModal(messageId) {
  selectedMessageId = messageId;
  emojiModal.style.display = 'block';
}

function closeEmojiModalHandler() {
  emojiModal.style.display = 'none';
  selectedMessageId = null;
}

function handleMessageReaction(messageId, userId, reaction, removing = false) {
  const messageElement = document.querySelector(`[data-id="${messageId}"]`);
  if (!messageElement) return;

  const reactionsContainer = messageElement.querySelector(
    '.reactions-container',
  );
  const existingEmojiReaction = Array.from(
    reactionsContainer?.querySelectorAll('.reaction') || [],
  ).find((el) => el.dataset.emoji === reaction);

  if (removing) {
    if (existingEmojiReaction) {
      const tooltipElement =
        existingEmojiReaction.querySelector('.reaction-tooltip');
      const countElement =
        existingEmojiReaction.querySelector('.reaction-count');
      const userListText = tooltipElement.textContent;
      const updatedUserListText = userListText.replace(
        new RegExp(`(, )?${userId}`),
        '',
      );
      const remainingUsers = updatedUserListText
        .split(',')
        .filter((u) => u.trim()).length;

      if (remainingUsers <= 0) {
        reactionsContainer.removeChild(existingEmojiReaction);
      } else {
        tooltipElement.textContent = updatedUserListText;
        countElement.textContent = remainingUsers;
        if (userId === currentUserId) {
          existingEmojiReaction.classList.remove('user-reacted');
        }
      }
    }
    if (userId === currentUserId) {
      userReactions.delete(messageId);
    }
  } else {
    if (userId === currentUserId) {
      const existingReaction = userReactions.get(messageId);
      if (existingReaction && existingReaction !== reaction) {
        handleMessageReaction(messageId, userId, existingReaction, true);
      }
      userReactions.set(messageId, reaction);
    }

    if (existingEmojiReaction) {
      const tooltipElement =
        existingEmojiReaction.querySelector('.reaction-tooltip');
      const userList = tooltipElement.textContent
        .split(',')
        .map((u) => u.trim())
        .filter((u) => u && u !== userId);
      if (!userList.includes(userId)) userList.push(userId);
      tooltipElement.textContent = userList.join(', ');
      const countElement =
        existingEmojiReaction.querySelector('.reaction-count');
      countElement.textContent = userList.length;
      if (userId === currentUserId)
        existingEmojiReaction.classList.add('user-reacted');
    } else {
      const reactionsContainer =
        messageElement.querySelector('.message-actions') ||
        messageElement.appendChild(document.createElement('div'));
      reactionsContainer.classList.add('reactions-container');

      const reactionElement = document.createElement('div');
      reactionElement.classList.add('reaction');
      reactionElement.dataset.emoji = reaction;
      if (userId === currentUserId)
        reactionElement.classList.add('user-reacted');

      const emojiSpan = document.createElement('span');
      emojiSpan.textContent = reaction;
      emojiSpan.classList.add('reaction-emoji');

      const countSpan = document.createElement('span');
      countSpan.textContent = '1';
      countSpan.classList.add('reaction-count');

      const tooltip = document.createElement('span');
      tooltip.textContent = userId;
      tooltip.classList.add('reaction-tooltip');

      reactionElement.appendChild(emojiSpan);
      reactionElement.appendChild(countSpan);
      reactionElement.appendChild(tooltip);

      reactionElement.addEventListener('click', () => {
        if (currentUserId) {
          const isUserReaction =
            reactionElement.classList.contains('user-reacted');
          socket.emit(isUserReaction ? 'removeReaction' : 'reactToMessage', {
            messageId: messageId,
            reaction: reaction,
          });
        }
      });

      reactionsContainer.appendChild(reactionElement);
    }
  }
}

// Connection Management
function connect() {
  const userId = userIdInput.value.trim();
  if (!userId) {
    addMessage('Please enter a User ID.', 'error');
    return;
  }

  if (socket?.connected) {
    addMessage(
      'Already connected. Disconnect first if you want to change User ID.',
      'status',
    );
    return;
  }

  currentUserId = userId;
  userReactions.clear();
  onlineUsers.clear();

  socket = io('http://localhost:3000', {
    query: { userId: userId },
  });

  connectionStatus.textContent = 'Status: Connecting...';
  addMessage(`Attempting to connect as User ID: ${userId}`, 'status');

  socket.on('connect', onConnect);
  socket.on('connection_success', onConnectionSuccess);
  socket.on('disconnect', onDisconnect);
  socket.on('error', onError);
  socket.on('joinedRoom', onJoinedRoom);
  socket.on('receiveMessage', onReceiveMessage);
  socket.on('messageReaction', onMessageReaction);
  socket.on('reactionRemoved', onReactionRemoved);
  socket.on('userPresenceUpdate', onUserPresenceUpdate);
  socket.on('userPresenceList', onUserPresenceList);
  socket.on('userPresenceInfo', onUserPresenceInfo);

  // Comment related events
  socket.on('commentAdded', (commentData) => {
    if (currentMessageForComments === commentData.messageId) {
      displayComment(commentData);
    }
  });

  socket.on('commentsList', (data) => {
    if (currentMessageForComments === data.messageId) {
      data.comments.forEach((comment) => displayComment(comment));
    }
  });
}

function onConnect() {
  connectionStatus.textContent = 'Status: Connected';
  connectionStatus.classList.add('connected');
  addMessage('Connected to chat server', 'status');
  appContainer.style.display = 'flex';
  userIdInput.disabled = true;
  connectButton.textContent = 'Disconnect';
  connectButton.onclick = disconnect;
}

function onConnectionSuccess(data) {
  addMessage(
    `Login success: ${data.userId} (Socket: ${data.clientId})`,
    'status',
  );
}

function onError(errorMsg) {
  addMessage(`Error: ${errorMsg}`, 'error');
}

function onDisconnect(reason) {
  connectionStatus.textContent = 'Status: Disconnected';
  connectionStatus.classList.remove('connected');
  addMessage(`Disconnected: ${reason}`, 'status');
  resetUI();
}

function onJoinedRoom(room) {
  addMessage(`Joined room: ${room}`, 'status');
  currentRoom = room;
  currentRoomStatus.textContent = `Currently in: #${currentRoom}`;
  messageInputContainer.style.display = 'flex';
  messageInput.focus();
}

function onReceiveMessage(message) {
  addMessage('', 'info', message);
}

function onMessageReaction(data) {
  handleMessageReaction(data.messageId, data.userId, data.reaction);
}

function onReactionRemoved(data) {
  handleMessageReaction(data.messageId, data.userId, data.reaction, true);
}

function onUserPresenceUpdate(presenceData) {
  onlineUsers.set(presenceData.userId, presenceData);
  updateOnlineUsersList();
  if (selectedUserForProfile?.userId === presenceData.userId) {
    showUserProfile(presenceData);
  }
}

function onUserPresenceList(userList) {
  onlineUsers.clear();
  userList.forEach((user) => onlineUsers.set(user.userId, user));
  updateOnlineUsersList();
}

function onUserPresenceInfo(presenceData) {
  onlineUsers.set(presenceData.userId, presenceData);
  showUserProfile(presenceData);
}

function resetUI() {
  appContainer.style.display = 'none';
  messageInputContainer.style.display = 'none';
  currentRoom = null;
  currentRoomStatus.textContent = 'Not in any room.';
  userIdInput.disabled = false;
  connectButton.textContent = 'Connect';
  connectButton.onclick = connect;
  userReactions.clear();
  onlineUsers.clear();
  onlineUsersList.innerHTML = '';
}

function disconnect() {
  if (socket) socket.disconnect();
}

function sendMessage() {
  const messageText = messageInput.value.trim();
  if (!messageText) return;

  if (socket?.connected && currentRoom) {
    socket.emit('sendMessage', {
      message: messageText,
      room: currentRoom,
    });
    messageInput.value = '';
    messageInput.focus();
  } else {
    addMessage('Not connected or not in a room.', 'error');
  }
}

// Event Listeners
closeProfileModal.addEventListener('click', () => {
  userProfileModal.style.display = 'none';
  selectedUserForProfile = null;
});

emojiList.addEventListener('click', (event) => {
  if (event.target.classList.contains('emoji-button') && selectedMessageId) {
    const reaction = event.target.dataset.emoji;
    const existingReaction = userReactions.get(selectedMessageId);
    socket.emit(
      existingReaction === reaction ? 'removeReaction' : 'reactToMessage',
      {
        messageId: selectedMessageId,
        reaction: reaction,
      },
    );
    closeEmojiModalHandler();
  }
});

closeEmojiModal.addEventListener('click', closeEmojiModalHandler);

// Comment Event Listeners
submitComment.addEventListener('click', () => {
  const commentText = commentInput.value.trim();
  if (commentText && currentMessageForComments) {
    socket.emit('addComment', {
      messageId: currentMessageForComments,
      text: commentText,
    });
    commentInput.value = '';
  }
});

commentInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    submitComment.click();
  }
});

closeCommentModal.addEventListener('click', closeCommentModalHandler);

// Connection and Message Listeners
connectButton.addEventListener('click', connect);

joinRoomButton.addEventListener('click', () => {
  const roomName = roomNameInput.value.trim();
  if (!roomName) {
    addMessage('Please enter a room name.', 'error');
    return;
  }
  if (socket?.connected) {
    addMessage(`Joining room: ${roomName}...`, 'status');
    socket.emit('joinRoom', roomName);
  } else {
    addMessage('Not connected to the server.', 'error');
  }
});

sendMessageButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') sendMessage();
});
