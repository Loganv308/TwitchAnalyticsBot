// Chat Message class used to execute methods and data related to chat messages. 
export class ChatMessage {
    constructor(message_id, id, user_id, username, message, timestamp, subscriber){
        this.message_id = message_id;
        this.id = id;
        this.user_id = user_id;
        this.username = username;
        this.message = message;
        this.timestamp = timestamp;
        this.subscriber = subscriber;
    }

    async formatMessageData(messageData) {
        const transformedData = messageData.map((message) => ({
            message_id: message.message_id,
            id: message.id,
            user_id: message.user_id,
            username: message.username,
            message: message.message,
            timestamp: message.timestamp,
            subscriber: message.subscriber,
        }));
        return await transformedData;
    }
}