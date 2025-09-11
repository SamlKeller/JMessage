import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const userSchema = new Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: Number,
        required: false
    },
    grade: {
        type: Number,
        required: true,
        default: 9
    },
    name: {
        type: String,
        required: true
    },
    chats: {
        type: Array,
        required: true,
        default: []
    },
    schedule: {
        type: Object,
        required: false
    },
    settings: {
        type: Object,
        required: false
    },
    bio: {
        type: String,
        required: true,
        default: "Student at Thomas Jefferson High School for Science and Technology"
    },
    profilePicture: {
        type: String,
        required: false
    },
    birthday: {
        type: Date,
        required: true
    }
});

export default mongoose.model('Message', userSchema);