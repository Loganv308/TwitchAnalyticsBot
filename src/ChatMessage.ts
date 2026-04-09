// ─── Interfaces ────────────────────────────────────────────────────────────
 
export interface MessageData {
  message_id: string;
  id: number | null;
  user_id: number;
  username: string;
  message: string;
  timestamp: string;
  subscriber: 0 | 1;
}
 
// ─── Class ─────────────────────────────────────────────────────────────────
 
export class ChatMessage implements MessageData {
  message_id: string;
  id: number | null;
  user_id: number;
  username: string;
  message: string;
  timestamp: string;
  subscriber: 0 | 1;
 
  constructor(
    message_id: string,
    id: number | null,
    user_id: number,
    username: string,
    message: string,
    timestamp: string,
    subscriber: 0 | 1
  ) {
    this.message_id = message_id;
    this.id         = id;
    this.user_id    = user_id;
    this.username   = username;
    this.message    = message;
    this.timestamp  = timestamp;
    this.subscriber = subscriber;
  }
 
  // Maps an array of raw message data into typed MessageData objects
  formatMessageData(messageData: MessageData[]): MessageData[] {
    return messageData.map((message) => ({
      message_id: message.message_id,
      id:         message.id,
      user_id:    message.user_id,
      username:   message.username,
      message:    message.message,
      timestamp:  message.timestamp,
      subscriber: message.subscriber,
    }));
  }
}