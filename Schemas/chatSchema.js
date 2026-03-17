import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const chatSchema = new Schema({
    members: {
        type: Array,
        required: true
    },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now
    },
    media: {
        type: Array,
        required: true,
        default: []
    },
    name: {
        type: String,
        required: false
    },
    picture: {
        type: String,
        required: false
    },
    chats: {
        type: Number,
        required: true
    },
    read: {
        type: Array,
        required: true
    },
    messageIds:{
        type: Array,
        required: true
    }
});

export default mongoose.model('Chat', chatSchema);




