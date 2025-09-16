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

app.get('/', async (req, res) => {
    let message = req.query.message || null;
    res.render('index', {
        profilePic: req.user?.profilePic || null,
        username: req.user?.username || null,
        session: req.user || {
            username: null
        },
        message: message,
        settings: JSON.stringify(req.user?.settings) || null
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

async function searchResults(term, page, type) {

    let pageSize = 10;

    let articles = [];
    let users = null;
    let comments = null;

    const articleQuery = { $text: { $search: term } };
    const articleSort = { score: { $meta: "textScore" } };

    const pagination = { skip: (page - 1) * pageSize, limit: pageSize };
    const regex = new RegExp(term, 'i');

    switch (type) {
        case 0:
        case 1:
            articles = await Article.find(articleQuery, { score: { $meta: "textScore" } }) // full documents
                .sort(articleSort)
                .skip(pagination.skip)
                .limit(pagination.limit)
                .lean();
            break;
    }

    if (type === 0 || type === 2) {

        users = await User.find({
                $or: [
                    { username: regex },
                    { name: regex }
                ]
        })

        .skip(pagination.skip)
        .select('-settings -password -lastLogin')
        .limit(pagination.limit)
        .lean();

    }

    if (type === 0 || type === 3) {
        comments = await Comment.find(
            { bodyText: regex } // no projection
        )
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean();
    }

    const originalArticles = [];
    const responseArticles = [];

    if (articles && Array.isArray(articles)) {
        for (const a of articles) {
            if (a.respondingTo == null) {
                originalArticles.push(a);
            } else {
                responseArticles.push(a);
            }
        }
    }

    return {
        articles: originalArticles,
        responses: responseArticles,
        users: users,
        comments: comments
    };

}

app.get("/about", (req, res) => {
    res.render('about', {
        username: req.user?.username || null,
        profilePic: req.user?.profilePic || null
    });
});

app.get("/welcomeArticle", /*Utils.ensureLogin,*/ async (req, res) => {

    const ndUser = await User.findOne({ username: 'ND' });
    const article = await welcomeArticle.findOne();

    res.render('welcomeArticle', {
        profilePic: 'ndProfile.png',
        username: req.user?.username || null,
        session: req.user || {
            username: null
        },
        author: JSON.stringify(ndUser),
        articleSpud: 'welcomeArticle',
        loggedIn: req.isAuthenticated(),
        articleViews: article.views || 0,
        articleShares: article.shares || 0,
    });

});

app.get("/privacy", (req, res) => {
    res.render('privacyPolicy', {
        username: req.user?.username || null,
        profilePic: req.user?.profilePic || null
    });
});

app.get("/use", (req, res) => {
    res.render('usePolicy', {
        username: req.user?.username || null,
        profilePic: req.user?.profilePic || null
    });
});

app.get('/register', Utils.ensureNotLogin, (req, res) => {
    let message = req.query.message || null;
    res.render("register", {
        message: req.query.message
    });
});

app.get("/moderation", (req, res) => {
    res.render('moderation', {
        username: req.user?.username || null,
        profilePic: req.user?.profilePic || null
    });
});

app.get("/ndPlus", (req, res) => {
    res.render('ndPlus', {
        username: req.user?.username || null,
        profilePic: req.user?.profilePic || null
    });
});

app.get("/discussions", (req, res) => {
    res.render('discussions', {
        username: req.user?.username || null,
        profilePic: req.user?.profilePic || null
    });
});

app.get("/opinions", (req, res) => {
    res.render('opinions', {
        username: req.user?.username || null,
        profilePic: req.user?.profilePic || null
    });
});

app.get("/legal", (req, res) => {
    res.render('legal', {
        username: req.user?.username || null,
        profilePic: req.user?.profilePic || null
    });
});

app.get("/explore", (req, res) => {
    res.render('explore', {
        username: req.user?.username || null,
        profilePic: req.user?.profilePic || null
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

app.get("/writeOpinion", Utils.ensureLogin, (req, res) => {
    res.render('writeOpinion', {
        username: req.user.username,
        profilePic: req.user.profilePic,
    });
});

app.get("/viewOpinion", Utils.ensureLogin, (req, res) => {
    res.render('viewOpinion', {
        username: req.user.username,
        profilePic: req.user.profilePic
    });
});

app.get("/viewOpinions", Utils.ensureLogin, (req, res) => {
    res.render('viewOpinions', {
        username: req.user.username,
        profilePic: req.user.profilePic,
        session: req.user
    });
});

// Test routing
app.get('/getOpinion/:id', async (req, res) => {
    try {

        const opinion = await Article.findById(req.params.id);

        if (!opinion) {
            return res.status(404).json({error: 'Opinion not found'});
        }

        res.json({message: opinion});
        
    } catch (err) {
        if (err.name === 'CastError') {
            res.status(400).json({ error: 'Invalid ID format' });
        } else {
            console.log(err);
            res.status(500).json({ error: 'Server error' });
        }
    }
    // const articleId = req.params.id
    // res.json({ message: articleId });

});

app.post("/getCard", (req, res) => {
    const body = req.body;
    const content = body["data"];
    const cardType = body["cardType"];

    res.render('partials/' + cardType, content);
})

app.get("/viewOpinion/:id", Utils.ensureLogin, async (req, res) => {
    try {

        const opinion = await Article.findById(req.params.id);

        if (!opinion) {
            return res.status(404).json({error: 'Opinion not found'});
        }

        res.render('viewOpinion', {
            username: req.user.username,
            profilePic: req.user.profilePic,
            opinion
        });
    } catch (err) {
        if (err.name === 'CastError') {
            res.status(400).json({ error: 'Invalid ID format' });
        } else {
            console.log(err);
            res.status(500).json({ error: 'Server error' });
        }
    }
});


// Infinite scroll opinion getting
app.post('/getOpinions', async (req, res) => {

    const { lastId, limit, exclude } = req.body;
    const query = {
        respondingTo: { $in: [null, undefined] }
    };

    // Exclude articles that have been loaded already.
    if (exclude && exclude.length > 0) {
        query._id = { $nin: exclude };
    }

    // For cursor-based pagination, if a lastId is provided:
    if (lastId) {
        // Merge with the existing query condition if needed.
        query._id = { ...(query._id || {}), $lt: lastId };
    }

    // Sort based on your desired metric (e.g., views)
    const articles = await Article.find(query)
        .sort({ views: -1 }) // or sort by any other metric
        .limit(Number(limit) || 10);

    
    if (req.isAuthenticated()) {
        for (let x = 0; x < articles.length; x++) {
            if (req.user.saves.includes(articles[x].url)) {
                articles[x].saved = true;
            }
            if (req.user.likes.includes(articles[x].url)) {
                articles[x].liked = true;
            }
        }
    } else {
        for (let x = 0; x < articles.length; x++) {
            articles[x].saved = false;
            articles[x].liked = false;
        }
    }

    res.json(articles);

});


//
// TODO: Change to heuristic based approach instead of getting top replies for personal recommendations
//
app.get('/getPersonalOpinions', async (req, res) => {
    const limit = Number(req.query.limit) || 2;
    const topArticles = await Article.find({})
        .sort({ replies: -1 })
        .limit(limit);
        res.json(topArticles);
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

//sharing increment
app.post('/incrementShares/:articleSpud', async (req,res) => {
    try {
        const article = await Article.findOneAndUpdate(
            { url: req.params.articleSpud },
            { $inc: {shares:1} },
            { new:true }
        );

        res.json({shares:article.shares});
    } catch (error) {
        console.error('error to increment share count:', error);
    }
});

app.post('/incrementWelcomeShares', async (req,res) => {
    try {

        const article = await welcomeArticle.findOneAndUpdate(
            {},
            { $inc: {shares:1} },
            { new:true }
        );

        res.json({shares:article.shares});
    
    } catch (error) {
        console.error('error to increment share count:', error);
    }
});



//view count
app.post('/incrementViews/:articleSpud', async (req, res) => {
    try {
        const article = await Article.findOneAndUpdate(
            {url:req.params.articleSpud },
            {$inc:{views:1} },
            {new:true }
        );

        res.json({ views: article.views });
    } catch (error) {
        console.error('Error to increment view count:', error);
    }
});

app.post('/incrementWelcomeViews', async (req, res) => {
    try {

        const article = await welcomeArticle.findOneAndUpdate(
            {},
            {$inc:{views:1} },
            {new:true }
        );

        res.json({ views: article.views });

    } catch (error) {
        console.error('Error to increment view count:', error);
    }
});

//reactions
app.post('/addWelcomeReaction', Utils.ensureLogin, async (req, res) => {
    try {

        const { articleUrl, reactionType } = req.body;
        const userId = req.user.id;
        const article = await welcomeArticle.findOne();

        if (!article.reactions) {
            article.reactions = {
                like: 0,
                heart: 0,
                party: 0,
                clap: 0,
                users: []
            };
        }

        //check if already reacted
        const existingReactionIndex = article.reactions.users.findIndex(
            user => user.userId === userId
        );

        let previousReaction = null;
        if (existingReactionIndex !== -1) {
            previousReaction = article.reactions.users[existingReactionIndex].reaction;
            
            //if same reaction, remove it (toggle off)
            if (previousReaction === reactionType) {
                article.reactions[reactionType]--;
                article.reactions.users.splice(existingReactionIndex, 1);
                await article.save();
                return res.json({ 
                    success: true, 
                    action: 'removed',
                    reactions: article.reactions 
                });
            }
            
            // different reaction, update it
            article.reactions[previousReaction]--;
            article.reactions[reactionType]++;
            article.reactions.users[existingReactionIndex].reaction = reactionType;
        } else {
            //new reaction
            article.reactions[reactionType]++;
            article.reactions.users.push({ userId, reaction: reactionType });
        }

        await article.save();
        res.json({ 
            success: true, 
            action: previousReaction?'changed':'added',
            reactions: article.reactions 
        });

    } catch (error) {
        console.error('error with adding reaction:', error);
    }
});

app.post('/addReaction', Utils.ensureLogin, async (req, res) => {
    try {
        const { articleUrl, reactionType } = req.body;
        const userId = req.user.id;
        const article = await Article.findOne({ url: articleUrl });

        if (!article.reactions) {
            article.reactions = {
                like: 0,
                heart: 0,
                party: 0,
                clap: 0,
                users: []
            };
        }

        //check if already reacted
        const existingReactionIndex = article.reactions.users.findIndex(
            user => user.userId === userId
        );

        let previousReaction = null;
        if (existingReactionIndex !== -1) {
            previousReaction = article.reactions.users[existingReactionIndex].reaction;
            
            //if same reaction, remove it (toggle off)
            if (previousReaction === reactionType) {
                article.reactions[reactionType]--;
                article.reactions.users.splice(existingReactionIndex, 1);
                await article.save();
                return res.json({ 
                    success: true, 
                    action: 'removed',
                    reactions: article.reactions 
                });
            }
            
            // different reaction, update it
            article.reactions[previousReaction]--;
            article.reactions[reactionType]++;
            article.reactions.users[existingReactionIndex].reaction = reactionType;
        } else {
            //new reaction
            article.reactions[reactionType]++;
            article.reactions.users.push({ userId, reaction: reactionType });
        }

        await article.save();
        res.json({ 
            success: true, 
            action: previousReaction?'changed':'added',
            reactions: article.reactions 
        });

    } catch (error) {
        console.error('error with adding reaction:', error);
    }
});

//get rearactions for article
app.get('/getReactions/:articleUrl', async (req, res) => {
    try {

        if (req.params.articleUrl == 'welcomeArticle') {
            return;
        }

        const article = await Article.findOne({ url: req.params.articleUrl });

        const userReaction = req.user ? 
            article.reactions?.users.find(user => user.userId === req.user.id)?.reaction : 
            null;

        res.json({
            reactions: article.reactions || { like: 0, heart: 0, party: 0, clap: 0, users: [] },
            userReaction
        });
    } catch (error) {
        console.error('error getting reactions:', error);
    }
});

app.get('/getWelcomeReactions', async (req, res) => {
    try {

        const article = await welcomeArticle.findOne();

        const userReaction = req.user ? 
            article.reactions?.users.find(user => user.userId === req.user.id)?.reaction : 
            null;

        res.json({
            reactions: article.reactions || { like: 0, heart: 0, party: 0, clap: 0, users: [] },
            userReaction
        });
    } catch (error) {
        console.error('error getting reactions:', error);
    }
});



const uploadImage = upload.single("file");
app.post("/postOpinion", Utils.ensureLogin, (req, res) => {
    uploadImage(req, res, async function (err) {
        //an error in this context generally means that there isn't an image
        let articleImage = null;
        const jsonData = JSON.parse(req.body.jsonData);

        if (req.file && req.file.key) {
            articleImage = process.env.PUBLICR2 + '/' + req.file.key;
        }

        if (!jsonData.category || !jsonData.title || !jsonData.content) {
            console.log("User attempting to post article without body");
            return res.send({
                error: 0,
                url: null
            });
        }
        if (jsonData.title.length > 115) {
            console.log("User attempting to post article with " + jsonData.title.length + " character title");
            return res.send({
                error: 1,
                url: null
            });
        }
        if (JSON.parse(jsonData.content).text.length > 25000) {
            console.log("User attempting to post " + JSON.parse(jsonData.content).text.length + " character article");
            return res.send({
                error: 2,
                url: null
            });
        }

        const articleTitle = jsonData.title.replaceAll(' ', '-').replaceAll('?', '').replaceAll('\"', '').replaceAll("'", '').replaceAll(/(\r\n|\n|\r)/gm, "").replaceAll('/', '') + "-" + makeHash(10);
        let maxLength = JSON.parse(jsonData.content).text.length;

        if (JSON.parse(jsonData.content).text.length > 200) {
            maxLength = 200;
        }
        let articleSummary = JSON.parse(jsonData.content).text.replaceAll(/(\r\n|\n|\r)/gm, "").substring(0, maxLength);
        if (jsonData.summary) {
            articleSummary = jsonData.summary;
        }

        const article = new Article({
            userId: req.user.id,
            title: jsonData.title.replaceAll(/(\r\n|\n|\r)/gm, "").replaceAll('/', ''),
            category: jsonData.category,
            date: new Date(),
            image: articleImage,
            views: 0,
            otherOpinions: 0,
            shares: 0,
            content: JSON.parse(jsonData.content),
            url: articleTitle,
            summary: articleSummary,
            responses: [],
            respondingTo: null,
            reactions: {
                like: 0,
                heart: 0,
                party: 0,
                clap: 0,
                users: []
            }
        });

        article.save();
        console.log("Posted new article: " + jsonData.title);

        res.send({
            error: null,
            url: "/" + articleTitle
        });
    });
});


app.get('/response/:articleSpud', Utils.ensureLogin, async (req, res) => {
    console.log("Responding to article " + req.params.articleSpud);

    const article = await getArticle(req.params.articleSpud);
    if (!article) {
        return res.redirect('/404');
    }

    const author = cleanUser(await getUser(article.userId));
    if (!article || !author) {
        console.log("Error: article or author not found");
        return res.redirect('/');
    }

    let articleTemp = article;
    articleTemp.content.text = articleTemp.content.text.replace(/(\n|")/g, function (match) {
        return match === "\n" ? "\\n": '\\"';
    }).replace(/(?:\r\n|\r|\n)/g, "<br>");

    res.render('respond', {
        profilePic: req.user?.profilePic || null,
        username: req.user?.username || null,
        session: req.user || {
            username: null
        },
        article: JSON.stringify(articleTemp),
        author: JSON.stringify(author),
        articleSpud: req.params.articleSpud
    });
});


app.post("/response/:spud", Utils.ensureLogin, async (req, res) => {
    if (!req.body.jsonData) {
        console.log("User attempting to respond to article with empty content");
        return res.status(400).json({
            error: 3,
            url: null
        });
    }

    const jsonData = JSON.parse(req.body.jsonData);

    if (!jsonData.category || !jsonData.title || !jsonData.content) {
        console.log("User attempting to post article without body");
        return res.send({
            error: 0,
            url: null
        });
    }
    if (jsonData.title.length > 115) {
        console.log("User attempting to post article with " + jsonData.title.length + " character title");
        return res.send({
            error: 1,
            url: null
        });
    }
    if (JSON.parse(jsonData.content).text.length > 25000) {
        console.log("User attempting to post " + JSON.parse(jsonData.content).text.length + " character article");
        return res.send({
            error: 2,
            url: null
        });
    }

    let respondingTo = await Article.findOne({url: req.params.spud});
    if (respondingTo == null) {
        console.log("Error: User attempting to respond to nonexistent article");
        return res.redirect('/');
    }
    const articleTitle = jsonData.title.replaceAll(' ', '-').replaceAll('?', '').replaceAll('\"', '').replaceAll("'", '') + "-" + makeHash(10);

    let maxLength = JSON.parse(jsonData.content).text.length;

    if (JSON.parse(jsonData.content).text.length > 200) {
        maxLength = 200;
    }
    let articleSummary = JSON.stringify(JSON.parse(jsonData.content).text.substring(0, maxLength));

    if (jsonData.summary) {
        articleSummary = jsonData.summary;
    }
    const article = new Article({
        userId: req.user.id,
        title: jsonData.title,
        category: jsonData.category,
        date: new Date(),
        image: null,
        views: 0,
        otherOpinions: 0,
        shares: 0,
        content: JSON.parse(jsonData.content),
        url: articleTitle,
        summary: articleSummary,
        responses: [],
        respondingTo: req.params.spud
    });
    article.save();

    let tempResponses = respondingTo.responses;
    tempResponses.push(article.url);

    await Article.findOneAndUpdate({ url: req.params.spud }, {
        responses: tempResponses
    });

    try {
        const originalAuthor = await User.findById(respondingTo.userId);
        if (originalAuthor) {
            await EmailService.sendResponseNotification(
                originalAuthor.email,
                originalAuthor.name,
                respondingTo.title,
                article.title,
                req.user.name,
                req.params.spud
            );
            console.log('response notification email sent to:', originalAuthor.email);
        }
    } catch (error) {
        console.error('failed to send response notification email', error);
    }

    console.log("Posted new article response: " + jsonData.title);

    res.send({
        error: null,
        url: "/" + articleTitle
    });
});


app.get("/privateRoom", (req, res) => {
    res.render('privateRoom', {
        username: req.user?.username || null,
        profilePic: req.user?.profilePic || null
    });
});

app.get("/contact", (req, res) => {
    res.render('contact', {
        username: req.user?.username || null,
        profilePic: req.user?.profilePic || null
    });
});

app.get('/adminPortal', (req, res) => {
    res.render('adminPortal');
});

app.get('/team', (req, res) => {
    res.render('team', {
        profilePic: req.user?.profilePic || null,
        username: req.user?.username || null
    });
});


async function authenticateUser(email, username, password) {
    if (username.length > 14) {
        return 0;
    } else if (await User.exists({ username: new RegExp('^' + username + '$', 'i') })) {
        return 1;
    } else if (await User.exists({ email: email.toLowerCase() })) {
        return 2;
    } else if (password.length < 6) {
        return 3;
    }
    return 4;
}

// Register route
app.post('/register', Utils.ensureNotLogin, async (req, res) => {
    //try {
        if (!req.body.email || !req.body.username || !req.body.password || !req.body.firstName || !req.body.lastName) {
            return res.redirect('/register?message=Fill out all fields');
        }

        switch (await authenticateUser(req.body.email, req.body.username, req.body.password)) {
            case 0:
                return res.redirect('/register?message=Username too long');
                break;
            case 1:
                return res.redirect('/register?message=Username taken');
                break;
            case 2:
                return res.redirect('/register?message=This email is already in use');
                break;
            case 3:
                return res.redirect('/register?message=Choose a longer password');
                break;
            case 4:
                //nice
                break;
            default:
                console.log("Invalid switch statement at registration");
                break;
        }

        if (!await profanityCheck(req.body.username, req.body.firstName + " " + req.body.lastName)) {
            return res.redirect('/register?message=Choose an appropriate name');
        }

        let now = Date.now();
        const user = new User({
            email: req.body.email,
            name: req.body.firstName.trim() + " " + req.body.lastName.trim(),
            username: req.body.username.trim(),
            lastLogin: now,
            registerTime: now,
            emailVerified: false,
            profilePic: "/defaultPic.svg",
            bio: "User has no description.",
            password: bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(8), null),
            settings: {
                darkMode: false,
                profilePublicity: 0, //0 for public, 1 for private, 2 for protected/anonymous
                country: 'USA',
                emailPreference: 0 //0 for all, 1 for some, 2 for none
            },
            creds: [],
            karma: 0,
            saves: [],
            likes: []
        });

        await user.save();

        try {
            await EmailService.sendWelcomeEmail(user.email, user.name);
            console.log('welcome email sent to', user.email);
        } catch (error) {
            console.error('failed to send welcome email', error);
        }

        //Log the user in automatically after account creation
        await req.login(user, function (err) {
            if (err) {
                console.log("Error: " + err);
                return res.redirect('/register?message=Error logging in user');
            } else {
                console.log("Registered new user");
                return res.redirect('/');
            }
        });
        //sendVerificationEmail(req.body.email.toLowerCase(), crypt);
    /*} catch (err) {
        console.log("Error registering user: " + err);
        return res.redirect('/register?message=Error registering user, try again?');
    }*/
});

async function profanityCheck (username, name) {
    return new Promise(async function (resolve, reject) {
        //facebook has a good csv we should download -- list of common profanities
        resolve(true);
    });
}

function usernameToLowerCase(req, res, next) {
    req.body.username = req.body.username.toLowerCase();
    next();
}

app.post('/login', Utils.ensureNotLogin, await passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}));

app.post('/writeOpinionLoginHome', Utils.ensureNotLogin, await passport.authenticate('local', {
    successRedirect: '/writeOpinion',
    failureRedirect: '/?message=incorrectLoginInfo',
    failureFlash: true
}));

app.post('/respondOpinionLogin/:spud', Utils.ensureNotLogin, (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            return res.redirect('/?message=incorrectLoginInfo');
        }

        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            return res.redirect('/response/' + req.params.spud);
        });

    })(req, res, next);
});

app.get('/login', Utils.ensureNotLogin, (req, res) => {
    res.render('login');
});

async function getUser (id) {
    try {
        return await User.findById(id);
    } catch (err) {
        console.log("Error getting user: " + err);
        return null;
    }
}

app.get('/article/:articleSpud', async (req, res) => {

    const article = await getArticle(req.params.articleSpud);

    if (!article) {
        return res.redirect('/404');
    }

    const author = cleanUser(await getUser(article.userId));

    if (!article || !author) {
        console.log("Error: article or author not found");
        return res.redirect('/');
    }

    let articleTemp = article;

    articleTemp.content.text = articleTemp.content.text.replace(/(\n|")/g, function (match) {
        return match === "\n" ? "\\n": '\\"';
    }).replace(/(?:\r\n|\r|\n)/g, "<br>");

    let liked = false;
    let saved = false;
    if (req.isAuthenticated()) {
        if (req.user.saves.includes(req.params.articleSpud)) {
            saved = true;
        }
        if (req.user.likes.includes(req.params.articleSpud)) {
            liked = true;
        }
    }

    //client will get the article text and responses via the api
    res.render('article', {
        profilePic: req.user?.profilePic || null,
        username: req.user?.username || null,
        session: req.user || {
            username: null
        },
        author: JSON.stringify(author),
        articleSpud: req.params.articleSpud,
        loggedIn: req.isAuthenticated(),
        articleViews: article.views || 0,
        articleShares: article.shares || 0,
        liked: liked,
        saved: saved
    });

});

async function getResponseSummary (spud) {
    return new Promise(async function (resolve, reject) {

        const article = await Article.findOne({ url: spud });

        if (!article) {
            console.log("Error: response summary failed because article doesn't exist");
            resolve(null);
        } else {
            
            const responses = await Article.find({
                url: { $in: article.responses.map(t => new RegExp(`^${t}$`, 'i')) }
            }).limit(5);
            
            let responseTemp = [];
            
            for (let x = 0; x < responses.length; x++) {
                const author = await Utils.getNameUsername(responses[x].userId);
                responseTemp.push({
                    title: responses[x].title,
                    author: author[0],
                    username: author[1],
                    views: responses[x].views,
                    responses: responses[x].responses,
                    spud: responses[x].url
                });
            }
            resolve(responseTemp);
        }
    });
}

async function getArticleAndResponder (spud) {
    const article = await Article.findOne({ url: spud });
    if (article) {
        let temp = article.toObject();
        if (article.respondingTo != null) {
            const respondingTo = await Article.findOne({url: article.respondingTo});
            temp.respondingTo = undefined;
            temp.respondingTo = {
                title: respondingTo.title,
                url: respondingTo.url
            };
        }
        return temp;
    } else {
        return null;
    }
}

app.get('/getArticle/:spud', async (req, res) => {

    console.log("Getting article and responder from " + req.params.spud);
    const article = await getArticleAndResponder(req.params.spud);
    const responses = await getResponseSummary(req.params.spud);

    if (article) {
        res.json({
            article: article,
            responses: responses
        });
    } else {
        res.json({
            error: 1,
            message: "Error returning article: not found"
        });
    }

});

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

async function getArticle (spud) {
    return new Promise(async function (resolve, reject) {
        const article = await Article.findOne({
            url: spud
        });
        if (article) {
            resolve(article);
        }
        resolve(null);
    });
}

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(async function (id, done) {
    try {
        const user = await User.findById(id);
        if (user) {
            done(null, user);
        } else {
            done(null, null);
        }
    } catch (err) {
        console.log("Error deserializing user: " + err);
        done(err, null);
    }
});

// Login
passport.use(new localStrategy(async function (username, password, done) {
    try {
        const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i') }) || await User.findOne({ email: new RegExp('^' + username + '$', 'i') });
        if (!user) {
            return done(null, false, { message: "Incorrect username or password" });
        } else {
            await bcrypt.compare(password, user.password, function (err, res) {
                if (err) {
                    return done(err);
                } else if (res == false) {
                    return done(null, false, { message: "Incorrect username or password" });
                } else {
                    return done(null, user);
                }
            });
        }
    } catch (err) {
        console.log("Error logging in user: " + err);
        return done(err);
    };
}));

app.post('/logout', Utils.ensureLogin, (req, res) => {
    try {
        req.logout(function (err) {
            if (err) {
                return next(err);
            }
            res.redirect('/');
        });
    } catch (err) {
        console.log("Error logging out: " + err);
        return res.redirect('/'); //use cookies to find previous request
    }
});

app.get('/logout', Utils.ensureLogin, (req, res) => {
    try {
        req.logout(function (err) {
            if (err) {
                return next(err);
            }
            res.redirect('/');
        });
    } catch (err) {
        console.log("Error logging out: " + err);
        return res.redirect('/'); //use cookies to find previous request
    }
});

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

//get settings GET
app.get('/getSettings', async (req, res) => {
    try {
        return res.send(req.user.settings);
    } catch (err) {
        console.log("Error getting account settings " + err);
        return res.redirect('/'); //use cookies to find previous request
    }
});

app.post('/changeSettings', Utils.ensureLogin, async (req, res) => {
    //TODO: make settings update a fetch request and listen for a response
    const publicity = req.body.publicity;
    const country = req.body.country;
    const email = req.body.email;

    if (validateSettingsInput(publicity, country, email)) {
        const settingsTemp = {
            darkMode: false,
            profilePublicity: publicity,
            country: country,
            emailPreference: email
        }
        await User.updateOne({username: req.user.username}, { 
            settings: settingsTemp
        });

        return res.send(200);
    }

    console.log("User attempted to update bogus settings");
    return res.send(400);

});

app.post('/likeArticle/:spud', Utils.ensureLogin, async (req, res) => {
    if (await checkArticleExistence(req.params.spud)) {
        
        const user = await User.findOne({username: req.user.username});

        if (user.likes.includes(req.params.spud)) {
            await User.updateOne(
                { username: req.user.username }, 
                { $pull: { likes: req.params.spud } }
            );
        } else {
            await User.updateOne(
                { username: req.user.username }, 
                { $push: { likes: req.params.spud } }
            );
        }

    }
});

//sending an error message for a failed save is weird so this is enough
app.post('/saveArticle/:spud', Utils.ensureLogin, async (req, res) => {
    if (await checkArticleExistence(req.params.spud)) {
        
        const user = await User.findOne({username: req.user.username});

        if (user.saves.includes(req.params.spud)) {
            await User.updateOne(
                { username: req.user.username }, 
                { $pull: { saves: req.params.spud } }
            );
        } else {
            await User.updateOne(
                { username: req.user.username }, 
                { $push: { saves: req.params.spud } }
            );
        }

    }
});

async function checkArticleExistence (spud) {

    const temp = await Article.findOne({ url: spud });

    if (temp) {
        return true;
    }

    return false;

}

function validateSettingsInput (publicity, country, email) {
    if (!publicity || !country || !email) {
        return false;
    }

    if (publicity != 0 && publicity != 1 && publicity != 2) {
        return false;
    }

    if (!Utils.countries.includes(country)) {
        return false;
    }
    if (email != 'all' && email != 'some' && email != 'none') {
        return false;
    }

    return true;
}

//update username POST
app.post('/updateUsername', async (req, res) => {
    try {
        await User.findOneAndUpdate({ username: req.user.username }, {
            username: req.body.username
        });
        return res.redirect('/profile');
    } catch (err) {
        console.log("Error updating username: " + err);
        return res.redirect('/'); //use cookies to find previous request
    }
});

async function getRandomArticle() {
    try {
        return await Article.findOne().skip(Math.floor(Math.random() * await Article.countDocuments()));
    } catch (err) {
        console.log("Error getting random article: " + err);
        return null;
    }
}

app.get('/randomArticle', async (req, res) => {
    let randomArticle = await getRandomArticle();
    if (randomArticle != null) {
        return res.redirect('/article/' + randomArticle.url);
    }
});

import { isNull } from "util";

app.use((req, res) => {
    console.log("404 at " + req.protocol + '://' + req.get('host') + req.originalUrl);
    res.sendStatus(404);
});

mongoose.connection.once("open", () => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});

export default { User, mongoose }