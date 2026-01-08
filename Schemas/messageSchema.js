import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const msgSchema = new Schema({
    chat: {
        type: String,
        required: true
    },
    fill: {
        type: Number,
        required: true
    },
    messages: {
        type: Array,
        required: true
    }
});

export default mongoose.model('Message', msgSchema);