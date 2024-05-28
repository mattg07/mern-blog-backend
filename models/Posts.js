const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const PostSchema = new Schema({
    title: String,
    content: String,
    cover: String,
    References: String,
    
}, {
    timestamps: true,
});

const PostModel = model('Post', PostSchema);
module.exports = PostModel;