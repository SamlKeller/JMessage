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
import _ from 'lodash';

import Utils from './utils.js';
import EmailService from './emailService.js';

import User from './Schemas/userSchema.js';
import Message from './Schemas/messageSchema.js';
import Chat from './Schemas/chatSchema.js';


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