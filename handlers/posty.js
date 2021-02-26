const { db } = require("../utils/admin");

exports.getAllPosts =  (req, res) => {
    db.collection('posts').orderBy('createdAt', 'desc').get()
        .then((data) => {
            let posts = [];
            data.forEach(doc => {
                posts.push({
                    postID: doc.id,
                    content: doc.data().content,
                    username: doc.data().username,
                    createdAt: doc.data().createdAt,
                    likeCount: doc.data().likeCount,
                    commentCount: doc.data().commentCount,
                    profilePic: doc.data().profilePic
                });
            });
            return res.json(posts);
        })
        .catch((err) => {
            console.error(err);
            res.status(500).json({ error: err.code });
        });
};

exports.letOnePost = (req, res) => {

    if(req.body.content.trim() === '') return res.status(400).json({ content: "Post nie moze być pusty!" });

    const newPost = {
        content: req.body.content,
        username: req.user.username,
        profilePic: req.user.profilePic,
        createdAt: new Date().toISOString(),
        likeCount: 0,
        commentCount: 0
    };

    db.collection('posts').add(newPost).then(doc => {
        const resPost = newPost;
        resPost.postID = doc.id;
        res.json(resPost)
    }).catch((err) => {
        res.status(500).json({ error: 'Coś poszło nie tak!' });
        console.error(err);
    })
};

exports.getPost = (req, res) => {
    let postData = {};

    db.doc(`/posts/${req.params.postID}`).get().then((doc) => {
        if(!doc.exists) {
            return res.status(404).json({ error: "Post nie istnieje!" });
        }
        postData = doc.data();
        postData.postID = doc.id;
        return db.collection('comments').orderBy('createdAt', 'desc').where('postID', '==', req.params.postID).get();
    }).then((data) => {
        postData.comments = [];
        data.forEach((doc) => {
            postData.comments.push(doc.data());
        });
        return res.json(postData);
    }).catch((err) => {
        console.error(err);
        res.status(500).json({ error: err.code })
    });
};

exports.commentOnPost = (req, res) => {
    if(req.body.content.trim() === '') return res.status(400).json({ comment: "Komentarz nie moze być pusty!" }); 

    const newComment = {
        content: req.body.content,
        createdAt: new Date().toISOString(),
        postID: req.params.postID,
        username: req.user.username,
        profilePic: req.user.profilePic
    };

    db.doc(`/posts/${req.params.postID}`).get()
    .then((doc) => {
        if(!doc.exists) return res.status(404).json({ error: "Post nie istnieje!" });
        
        return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
        
    }).then(() => {
        return db.collection('comments').add(newComment);
    }).then(() => {
        res.json(newComment);
    }).catch((err) => {
        console.error(err);
        res.status(500).json({ error: "Coś poszło nie tak!" });
    });
};

exports.likePost = (req, res) => {
    const likeDocument = db.collection('likes').where('username', '==', req.user.username)
                        .where('postID', '==', req.params.postID).limit(1);

    const postDocument = db.doc(`/posts/${req.params.postID}`);

    let postData = {};

    postDocument.get().then((doc) => {
        if(doc.exists) {
            postData = doc.data();
            postData.postID = doc.id;
            return likeDocument.get();
        } else {
            return res.status(404).json({ error: "Post nie istnieje" });
        }
    }).then((data) => {
        if(data.empty) {
            return db.collection('likes').add({
                postID: req.params.postID,
                username: req.user.username
            }).then(() => {
                postData.likeCount++;
                return postDocument.update({ likeCount: postData.likeCount });
            }).then(() => {
                return res.json(postData);
            });
        } else {
            return res.status(400).json({ error: "Post juz polajkowany!" });
        };
    }).catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
    })
};

exports.unlikePost = (req, res) => {
    const likeDocument = db.collection('likes').where('username', '==', req.user.username)
                        .where('postID', '==', req.params.postID).limit(1);

    const postDocument = db.doc(`/posts/${req.params.postID}`);

    let postData = {};

    postDocument.get().then((doc) => {
        if(doc.exists) {
            postData = doc.data();
            postData.postID = doc.id;
            return likeDocument.get();
        } else {
            return res.status(404).json({ error: "Post nie istnieje" });
        }
    }).then((data) => {
        if(data.empty) {
            return res.status(400).json({ error: "Post juz polajkowany!" });
        } else {
            return db.doc(`/likes/${data.docs[0].id}`).delete().then(() => {
                postData.likeCount--;
                return postDocument.update({ likeCount: postData.likeCount });
            }).then(() => {
                res.json(postData);
            })
        };
    }).catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
    })
};

exports.deletePost = (req, res) => {
    const document = db.doc(`/posts/${req.params.postID}`);
    document.get()
        .then((doc) => {
            if(!doc.exists) {
                return res.status(404).json({ error: "Post nie istnieje!" });
            }
            if(doc.data().username !== req.user.username){
                return res.statur(403).json({ error: "Brak uprawnień" });
            } else {
                return document.delete();
            }
        }).then(() => {
            res.json({ message: "Post usunięty pomyślnie!" });
        }).catch((err) => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
}