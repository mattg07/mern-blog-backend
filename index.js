const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const uploadMiddleware = multer({ dest: "uploads/" });
const Post = require("./models/Posts");
const Comment = require("./models/Comments");
require("dotenv").config();
const PORT = process.env.PORT || 4000;
const fs = require("fs");
const app = express();

const salt = 10;
const secret = process.env.SECRET_KEY;
app.use(
  cors({
    credentials: true,
    origin: "https://mern-blog-frontend-47cb.onrender.com",
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/uploads", express.static(__dirname + "/uploads"));

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
      isAdmin: false,
    });
    res.json(userDoc);
  } catch (e) {
    res.status(400).json(e);
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  const passOk = bcrypt.compareSync(password, userDoc.password);
  
  if (passOk) {
    jwt.sign(
      { username, id: userDoc._id, isAdmin: userDoc.isAdmin },
      secret,
      {},
      (err, token) => {
        if (err) throw err;
        
        // Set cookie configuration
        const cookieOptions = {
          httpOnly: true, // Prevent client-side access
          secure: true, // Send only over HTTPS
          sameSite: 'None', // Allow cross-site requests
          // Optionally set an expiration date
          expires: new Date(Date.now() + 3600000), // 1 hour from now
        };

        // Set the token cookie
        res.cookie("token", token, cookieOptions).json({
          id: userDoc._id,
          username,
          isAdmin: userDoc.isAdmin,
          token,
        });
      }
    );
  } else {
    res.status(400).json("Wrong credentials");
  }
});


app.get("/profile", async (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: "Token not provided" });
  }

  jwt.verify(token, secret, {}, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: user._id,
      username: user.username,
      isAdmin: user.isAdmin,
      token,
    });
  });
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

app.post("/post", uploadMiddleware.single("file"), async (req, res) => {
  const token = req.cookies.token;
  console.log(token);
  if (!token) {
    return res.status(401).json({ message: "JWT token must be provided" });
  }

  try {
    const decodedToken = jwt.verify(token, secret);
    const user = await User.findById(decodedToken.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ message: "Permission denied" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { originalname, path } = req.file;
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    const newPath = path + "." + ext;
    fs.renameSync(path, newPath);

    const { title, content, references } = req.body;

    const postDoc = await Post.create({
      title,
      references,
      content,
      cover: newPath,
    });

    res.json({ postDoc });
  } catch (error) {
    return res.status(401).json({ message: "Invalid JWT token" });
  }
});

app.get("/posts", async (req, res) => {
  try {
    let limit = parseInt(req.query.limit) || 3; // Set the limit to 3 if not provided
    let page = parseInt(req.query.page) || 1; // Parse the page query parameter or set default to 1
    let skip = (page - 1) * limit; // Calculate the number of documents to skip

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

app.get("/post/:id", async (req, res) => {
  const { id } = req.params;
  const postDoc = await Post.findById(id);
  res.json(postDoc);
});
app.post("/comment", async (req, res) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: "JWT token must be provided" });
  }

  try {
    const decodedToken = jwt.verify(token, secret);
    const user = await User.findById(decodedToken.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { postId, content } = req.body;

    const comment = await Comment.create({
      postId,
      username: user.username,
      content,
    });

    res.json(comment);
  } catch (error) {
    return res.status(401).json({ message: "Invalid JWT token" });
  }
});

app.get("/comments/:postId", async (req, res) => {
  const { postId } = req.params;
  try {
    const comments = await Comment.find({ postId }).sort({ createdAt: -1 });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}/`);
});
