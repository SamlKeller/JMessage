import { } from "dotenv/config";

import express from "express";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import path from "path";
import session from 'express-session';
import passport from "passport";
import localStrategy from "passport-local";
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import flash from 'express-flash';
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuid } from "uuid";

import pkg from 'lodash';
const { chunk } = pkg;

import Utils from './utils.js';
import EmailService from './emailService.js';

import User from './Schemas/userSchema.js';
import Message from './Schemas/messageSchema.js';
import Chat from './Schemas/chatSchema.js';

import IonStrategy from './ionStrategy.js';


const PORT = process.env.PORT || 3000;

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

//MongoDB and mongoose
import mongoose from 'mongoose';
mongoose.set("strictQuery", false);

mongoose.connect(process.env.DBURI);

app.use(session({
    secret: crypto.randomBytes(20).toString('hex'),
    resave: true,
    saveUninitialized: true,
    resave: true,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);
app.use(express.static(path.join(_dirname, "../static")));

app.use(express.static("static"));
app.use(express.static("static/css"));
app.use(express.static("static/images"));
app.use(express.static("static/scripts"));
app.use(express.static("views/partials"));

app.set("view engine", "ejs");
app.set("views", path.join(_dirname, 'views'));


const S3 = new S3Client({
    region: "auto",
    endpoint:
        `https://` +
        process.env.CLOUDFLAREACCOUNTID +
        `.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.CLOUDFLAREACCESSKEY,
        secretAccessKey: process.env.CLOUDFLARESECRETACCESSKEY,
    },
});

const upload = multer({
    storage: multerS3({
        s3: S3,
        bucket: "normaldebate",
        metadata: (req, file, cb) => {
            cb(null, { fieldName: file.fieldname });
        },
        key: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            cb(null, `${uuid()}${ext}`);
        },
    }),
    limits: {
        fields: 5,
        fieldNameSize: 50,
        fieldSize: 20000,
        fileSize: 5 * 1024 * 1024, //5MB
    },
    fileFilter: function (_req, file, cb) {
        checkFileType(file, cb);
    },
});

function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(
        path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        return cb(null, false);
    }
}

app.get('/', (req, res) => {
    res.render('home', {
        user: req.user || null
    });
});

app.get('/home', Utils.ensureLogin, async (req, res) => {

    const chats = await findChats(req.user.username);

    res.render('index', {
        user: JSON.stringify(req.user),
        chats: JSON.stringify(chats)
    });
});

async function findChats (username) {
    
    const results = await Chat.find({ members: username });

    if (results) {
        return results;
    }

    return [];

}

function toTitleCase(str) {

    if (!str) {
        return "";
    }

    return str.replace(
        /\w\S*/g,
        text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    );
}

app.post('/newChat', Utils.ensureLogin, async (req, res) => {

    if (!req.body.chatUser) {
        console.log("Error starting new chat: chat user not specified");
    }

    let otherUser = await findOtherUser(toTitleCase(req.body.chatUser).trim());

    const newChunk = new Message({
        fill: 0,
        messages: [],
        index: 0
    });

    await newChunk.save();

    const chat = new Chat({
        members: [req.user.username, otherUser.username],
        createdAt: Date.now(),
        media: [],
        name: req.body?.chatName || null,
        picture: null,
        chats: 0, 
        messageIds: [newChunk._id]
    });

    chat.save();

    console.log("New chat created");

    return res.redirect('/home');

});

app.post('/deleteChat/:id', Utils.ensureLogin, async (req, res) => {
    
    const chat = await Chat.findOne({ id: req.params.id });

    if (chat && chat?.members.includes(req.user.username)) {

        await Chat.deleteOne({ id: req.params.id });

        return res.json({
            status: '200'
        });

    } else {

        return res.json({
            status: '401'
        });

    }

});

app.post('/leaveChat/:id', Utils.ensureLogin, async (req, res) => {
    
    const chat = await Chat.findOne({ id: req.params.id });

    if (chat && chat?.members.includes(req.user.username)) {

        let newMembers = chat.members;
        
        newMembers.splice(newMembers.indexOf(req.user.username), 1);    

        await Chat.updateOne({ id: req.params.id }, {
            members: newMembers
        });

        return res.json({
            status: '200'
        });

    } else {

        return res.json({
            status: '401'
        });

    }

});


app.post('/markChatAsUnread/:id', Utils.ensureLogin, async (req, res) => {
    
    const chat = await Chat.findOne({ id: req.params.id });

    if (chat && chat?.members.includes(req.user.username)) {

        if (chat.read.includes(req.user.username)) {
            
            let newRead = chat.read;

            newRead.splice(newRead.indexOf(req.user.username), 1);

            await Chat.updateOne({ id: req.params.id }, {
                read: newRead
            });

            res.json({
                status: "200"
            });

        } else {
            console.log("Error: user trying to mark unread chat as unread");
            return res.json({
                status: "400"
            });
        }

    } else {

        return res.json({
            status: '401'
        });

    }

});

app.get('/chat/:id', Utils.ensureLogin, async (req, res) => {

    try{ 
        const chat = await Chat.findById(req.params.id);

        if (chat) {
            if (chat.members.includes(req.user.username)) {

                const messages = await Message.findOne({ chat: chat._id }).sort({ index: -1 });

                return res.json({
                    messages: messages,
                    status: "200"
                });
            }
        }

        return res.json({
            messages: [],
            status: "400"
        }); 
        
    } catch (err) {
        console.error("Error fetching chat:", err);
        return res.status(500).json({ messages: [], status: "500", error: err.message });
    }

});

app.post('/sendMessage/:chatId', Utils.ensureLogin, async(req, res) =>  {

    const chat = await Chat.findById(req.params.chatId);
    
    if (!chat?.members.includes(req.user.username)) {

        console.log("Not sending message, chat doesnt include user");

        return res.json({status: '401'});
    
    }

    const currChunk = await Message.findById(chat.messageIds[chat.messageIds.length - 1]);

    const newMsg = {
        sender: req.user.username, 
        text: req.body.msg,
        timeSent: new Date()
    };

    if (!currChunk || currChunk.fill >= 50){

        const newIndex = currChunk ? currChunk.index + 1 : 0;

        const newChunk = new Message({
            fill: 1,
            messages: [newMsg],
            index: newIndex
        });

        let tempIds = chat.messageIds;

        tempIds.push(newChunk._id);

        await newChunk.save();

        await Chat.findOneAndUpdate({ _id: req.params.chatId }, {
            messageIds: tempIds
        });
        
    } else {

        currChunk.messages.push(newMsg);
        currChunk.fill += 1;

        await currChunk.save();
    }

    res.json({
        status: 200
    });

});

async function findOtherUser (id) {

    const user = await User.findOne({ name: id });

    if (user) {
        return user;
    }

    return null;

}   

app.post('/testSearch', async (req, res) => {
    try{
        let aggUsers = [];
        await User.find({}, {name:1, _id:0})
            .then(users => {
                users.forEach(user => {
                    aggUsers.push(user.name);
                });
            });
        return res.send(aggUsers);
    } catch (err) {
        console.log(err);
    }
});

app.post('/getChat/:id', async (req, res) => {

    const chat = await Chat.findById(req.params.id);

    if (chat && chat?.members.includes(req.user.username)) {
    
        res.send({
            status: 200,
            messages: await Message.findById(chat.messageIds[chat.messageIds.length - 1])
        });

    } else {

        res.send({
            status: 400,
            messages: []
        });
        
    }

});

app.get('/search', async (req, res) => {

    if (req.query.search) {

        res.render('search', {
            username: req.user?.username || null,
            profilePic: req.user?.profilePic || null,
            session: req.user || {
                username: null
            },
            term: req.query.term
        });

    } else {

        res.render('search', {
            username: req.user?.username || null,
            profilePic: req.user?.profilePic || null,
            session: req.user || {
                username: null
            },
            term: req.query.term
        });

    }

});

app.post('/searchFor', async (req, res) => {

    const { term, page = 1, type = 0 } = req.body;

    if (!term) {
        console.log("Error: User attempting to search with no term");
        return 'NORES';
    }

    return res.json(await searchResults(term, Math.max(1, Number(page) || 1), Number(type)));

});

app.get("/about", (req, res) => {
    res.render('about', {
        user: req.user || null,
    });
});

// Need to be VERY careful to not leak info
app.get("/getUserInfo", async (req, res) => {
    try {
        
        return res.json(await User.findById(req.query.id)
            .select('-settings -password -lastLogin -_id')
            .lean()
        );

    } catch (err) {
        console.log("Error finding user: " + err);
        return res.json({});
    }
});

function makeHash (length) {

    let result = '';

    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;

    while (counter < length) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
        counter += 1;
    }

    return result;

}

app.get("/contact", (req, res) => {
    res.render('contact', {
        username: req.user?.username || null,
        profilePic: req.user?.profilePic || null
    });
});

app.get('/team', (req, res) => {
    res.render('team', {
        profilePic: req.user?.profilePic || null,
        username: req.user?.username || null
    });
});

function usernameToLowerCase(req, res, next) {
    req.body.username = req.body.username.toLowerCase();
    next();
}

async function getUser (id) {
    try {
        return await User.findById(id);
    } catch (err) {
        console.log("Error getting user: " + err);
        return null;
    }
}

//delete private fields
function cleanUser(usr) {

    if (!usr) {
        return null;
    }

    usr.password = undefined;
    usr.settings = undefined;
    usr.lastLogin = undefined;
    usr.emailVerified = undefined;

    return usr;

}

passport.use(IonStrategy);

passport.serializeUser(function (user, done) {
    done(null, user.username || user._doc?.username);
});

passport.deserializeUser(async function (username, done) {
    try {
        const user = await User.findOne({ username: username });
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

app.get('/auth/ion', (req, res, next) => {
    passport.authenticate('ion')(req, res, next);
});

app.get('/auth/ion/callback', 
    (req, res, next) => {
        
        passport.authenticate('ion', { 
            failureRedirect: '/login?error=ion_auth_failed',
            failureFlash: true 
        })(req, res, next);

    },
    async (req, res) => {
        
        try {

            if (!req.user) {
                console.error('[Ion Callback] No user object from Ion strategy');
                return res.redirect('/login?error=no_user_data');
            }

            let user = await User.findOne({ 
                username: req.user.username 
            });
            
            if (!user) {

                const now = Date.now();
                
                user = new User({
                    username: req.user.username,
                    email: req.user.email,
                    phoneNumber: 0,
                    grade: req.user.grade,
                    name: req.user.fullName || `${req.user.firstName} ${req.user.lastName}`,
                    chats: [],
                    schedule: { },
                    settings: { },
                    bio: "Student at Thomas Jefferson High School for Science and Technology",
                    birthday: req.user.birthday,
                    online: "online"
                });
                
                await user.save();
                
                /*try {
                    if (EmailService && EmailService.sendWelcomeEmail) {
                        await EmailService.sendWelcomeEmail(
                            user.email, 
                            user.name,
                            { grade: req.user.grade }
                        );
                    }
                } catch (error) {
                    console.error('[Ion Callback] Failed to send welcome email:', error.message);
                }*/

            } else {

                user.lastLogin = Date.now();

                if (req.user.grade) {
                    user.settings = user.settings || {};
                    user.settings.grade = req.user.grade;
                }

                await user.save();

            }
            
            req.session.ionTokens = {
                accessToken: req.user.accessToken,
                refreshToken: req.user.refreshToken
            };
            
            
            req.logIn(user, (err) => {
                if (err) {
                    console.error('[Ion Callback] Login error:', err);
                    return res.redirect('/login?error=login_failed');
                }
                                
                req.session.save((err) => {
                    if (err) {
                        console.error('[Ion Callback] Session save error:', err);
                    }
                    
                    const returnTo = req.session.returnTo || '/home';
                    delete req.session.returnTo;

                    res.redirect(returnTo);

                });
            });
            
        } catch (error) {
            console.error('[Ion Callback] Error processing callback:', error);
            res.redirect('/login?error=oauth_processing_failed');
        }
    }
);

app.get('/people/:username', async (req, res) => {

    if (req.isAuthenticated()) {
        if (req.user.username.toLowerCase() == req.params.username.toLowerCase()) {
            return res.redirect('/profile');
        }
    }

    res.render('otherProfile', {
        username: req.user?.username || null,
        profilePic: req.user?.profilePic || null,
        person: await findPerson(req.params.username)
    });

});

async function findPerson (username) {
    try {
        const user = await User.findOne({"username": { $regex: /username/i }});

        if (user) {
            return cleanUser(user);
        } else {
            console.log("User " + username + " not found");
            return null;
        }

    } catch (err) {
        console.log("Error finding user: " + err);
    }

}

app.delete('/deleteUser', Utils.ensureLogin, async (req, res) => {
    try {
        req.logout(function (err) {
            if (err) {
                return next(err);
            }
        });

        await User.deleteOne({ id: req.user.id });
        return res.redirect('/');
    } catch (err) {
        console.log("Error deleting profile: " + err);
        return res.redirect('/'); //use cookies to find previous request
    }
});

app.get('/noUser', (req, res) => {
    res.render('noUser', {
        profilePic: req.user?.profilePic || null
    });
});

app.use((req, res) => {
    console.log("404 at " + req.protocol + '://' + req.get('host') + req.originalUrl);
    res.sendStatus(404);
});

mongoose.connection.once("open", () => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});

export default { User, mongoose }