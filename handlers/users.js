const { admin, db } = require("../utils/admin");
const config = require("../utils/config");

const firebase = require("firebase");
firebase.initializeApp(config);

const { validateAtSignUp, validateAtLogIn,reduceUserDetails } = require("../utils/validators");
const { user } = require("firebase-functions/lib/providers/auth");

exports.signUp = (req, res) => {
    const newUser = {
        username: req.body.username,
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword
    };

    const { valid, errors } = validateAtSignUp(newUser);

    if(!valid) return res.status(400).json(errors);

    const noImage = 'noProfile.png';

    let token, userID;
    db.doc(`/users/${newUser.username}`).get().then((doc) => {
        if(doc.exists) {
            return res.status(400).json({ username: "Nazwa uytkownika jest juz wykorzystywana" });
        } else {
            return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password);
        }
    }).then((data) => {
        userID = data.user.uid;
        return data.user.getIdToken();
    }).then((idToken) => {
        token = idToken;
        const userCredentials ={
            username: newUser.username,
            email: newUser.email,
            createdAt: new Date().toISOString(),
            profilePic: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImage}?alt=media`,
            userID
        };
        db.doc(`/users/${newUser.username}`).set(userCredentials);
    }).then(() => {
        return res.status(201).json({ token })
    }).catch((err) => {
        console.error(err);
        if(err.code === 'auth/email-already-in-use') {
            return res.status(400).json({ email: "Email jest juz wykorzystywany" });
        } else {
            return res.status(500).json({ general: "Coś poszło nie tak! Spróbuj ponownie" });
        }
    })
};

exports.logIn = (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    };

    const { valid, errors } = validateAtLogIn(user);

    if(!valid) return res.status(400).json(errors);

    firebase.auth().signInWithEmailAndPassword(user.email, user.password).then((data) => {
        return data.user.getIdToken();
    }).then((token) => {
        return res.json({ token });
    }).catch((err) => {
        console.error(err);
         return res.status(400).json({ general: "Błędne hasło/login! Spróbuj ponownie" });
    });
};

exports.uploadProfilePic = (req, res) => {
    const BusBoy = require("busboy");
    const path = require("path");
    const os = require("os");
    const fs = require("fs");

    const busboy = new BusBoy({ headers: req.headers  });

    let imgFileName;
    let imgToBeUploaded = {};

    busboy.on('file', (fieldname, file, filename, mimetype) => {
        if(mimetype !== "image/jpeg" && mimetype !== "image/jpg" && mimetype !== "image/png") {
            return res.status(400).json({ error: "Nieobsługiwany typ pliku" })
        }

        const imgExtension = filename.split('.')[filename.split('.').length - 1];
        imgFileName = `${Math.round(Math.random()*1000000000000)}.${imgExtension}`;
        const filePath = path.join(os.tmpdir(), imgFileName);
        imgToBeUploaded = { filePath, mimetype };
        file.pipe(fs.createWriteStream(filePath));
    });

    busboy.on('finish', () => {
        admin.storage().bucket().upload(imgToBeUploaded.filePath, {
            resumable: false,
            metadata: {
                metadata: {
                    contentType: imgToBeUploaded.mimetype
                }
            }
        }).then(() => {
            const profilePic = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imgFileName}?alt=media`;
            return db.doc(`/users/${req.user.username}`).update({ profilePic });
        }).then(() => {
            return res.json({ message: "Plik przesłany pomyślnie" });
        }).catch((err) => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        })
    });

    busboy.end(req.rawBody);
};

exports.addUserDetails = (req, res) => {
    let userDetails = reduceUserDetails(req.body);
    db.doc(`/users/${req.user.username}`).update(userDetails).then(() => {
        return res.json({ message: "Szczegóły uzytkownika zapisane" });
    }).catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
    });
};

exports.getUserDetails = (req, res) => {
    let userData = {};
    db.doc(`/users/${req.params.username}`).get()
        .then((doc) => {
            if(doc.exists) {
                userData.user = doc.data();
                return db.collection('posts').where('username', '==', req.params.username).orderBy('createdAt', 'desc').get();
            } else {
                return res.status(404).json({ error: "Uzytkownik nie istnieje!" })
            }
        }).then((data) => {
            userData.posts = [];
            data.forEach((doc) => {
                userData.posts.push({
                    content: doc.data().content,
                    createdAt: doc.data().createdAt,
                    username: doc.data().username,
                    profilePic: doc.data().profilePic,
                    likeCount: doc.data().likeCount,
                    commentCount: doc.data().commentCount,
                    postID: doc.id
                });
            });
            return res.json(userData);
        }).catch((err) => {
            console.error(err);
            return res.status(500).json({ error: err.code })
        })
};

exports.markNotificationsRead = (req, res) => {
    let batch = db.batch();
    req.body.forEach((notificationId) => {
        const notification = db.doc(`/notifications/${notificationId}`);
        batch.update(notification, { read: 'true' });
    });
    batch.commit().then(() => {
        return res.json({ message: "Powiadomienia oznaczone jako przeczytane" });
    }).catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
    });
};

exports.getAuthUser = (req, res) => {
    let resData = {};
    db.doc(`/users/${req.user.username}`)
      .get()
      .then((doc) => {
        if (doc.exists) {
          resData.credentials = doc.data();
          return db
            .collection("likes")
            .where("username", "==", req.user.username)
            .get();
        }
      })
      .then((data) => {
        resData.likes = [];
        data.forEach((doc) => {
          resData.likes.push(doc.data());
        });
        return db
          .collection("notifications")
          .where("recipient", "==", req.user.username)
          .orderBy("createdAt", "desc")
          .limit(10)
          .get();
      })
      .then((data) => {
        resData.notifications = [];
        data.forEach((doc) => {
          resData.notifications.push({
            recipient: doc.data().recipient,
            sender: doc.data().sender,
            createdAt: doc.data().createdAt,
            postID: doc.data().postID,
            type: doc.data().type,
            read: doc.data().read,
            notificationId: doc.id,
          });
        });
        return res.json(resData);
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  };