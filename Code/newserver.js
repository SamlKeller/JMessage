import express from "express";

const PORT = process.env.PORT || 3000;

const app = express();


app.get('/', (req, res) => {
    res.send("It's working");
});

app.use((req, res) => {
    console.log("404 at " + req.protocol + '://' + req.get('host') + req.originalUrl);
    res.sendStatus(404);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));