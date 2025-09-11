import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const msgSchema = new Schema({
    to: {
        type: String,
        required: true
    },
    from: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    media: {
        type: Array,
        required: false,
        default: []
    }
});

export default mongoose.model('Message', msgSchema);