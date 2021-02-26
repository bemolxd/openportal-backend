const functions = require("firebase-functions");
const app = require("express")();

const { db } = require("./utils/admin");

const cors = require("cors");
app.use(cors());

const { 
    getAllPosts, 
    letOnePost, 
    getPost, 
    commentOnPost, 
    likePost, 
    unlikePost, 
    deletePost 
} = require("./handlers/posty");

const { 
    signUp, 
    logIn, 
    uploadProfilePic, 
    addUserDetails, 
    getAuthUser, 
    getUserDetails, 
    markNotificationsRead
} = require("./handlers/users");

// Do działań wymagających autoryzacji uytkownika
const fbauth = require("./utils/fbauth");

// Wyświetl wszystkie posty
app.get('/posts', getAllPosts)
// Utwórz nowy post
app.post('/post', fbauth, letOnePost);
// Zarejestruj nowego uzytkownika
app.post('/signup', signUp);
// Zaloguj uzytkownika
app.post('/login', logIn);
// Prześlij zdjęcie profilowe
app.post('/user/image', fbauth, uploadProfilePic);
// Dodaj/edytuj dane uytkownika
app.post('/user', fbauth, addUserDetails);
// Zbierz dane z zalogowanego profilu
app.get('/user', fbauth, getAuthUser);
// Wyświetl komentarze konkretnego posta
app.get('/post/:postID', getPost);
// Dodaj komentarz
app.post('/post/:postID/comment', fbauth, commentOnPost);
// Polub post
app.get('/post/:postID/like', fbauth, likePost);
app.get('/post/:postID/unlike', fbauth, unlikePost);
// Usuń post
app.delete('/post/:postID', fbauth, deletePost);
// Uzyskaj informacje o uytkowniku
app.get('/user/:username', getUserDetails);
// Oznacz powiadomienia jako przeczytane
app.post('/notifications', fbauth, markNotificationsRead);

exports.api = functions.region('europe-west1').https.onRequest(app);

// Nowe powiadomienie o polubieniu
exports.createNotificationOnLike = functions.region('europe-west1').firestore.document('likes/{id}')
    .onCreate((snapshot) => {
        return db.doc(`/posts/${snapshot.data().postID}`)
            .get()
            .then((doc) => {
                if(doc.exists && doc.data().username !== snapshot.data().username) {
                    return db.doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().username,
                        sender: snapshot.data().username,
                        type: 'like',
                        read: false,
                        postID: doc.id
                    });
                }
            }).catch((err) => {
                console.error(err);
        });
    });
// Nowe powiadomienie o komentarzu
exports.createNotificationOnComment = functions.region('europe-west1').firestore.document('comments/{id}')
    .onCreate((snapshot) => {
        return db.doc(`/posts/${snapshot.data().postID}`).get()
            .then((doc) => {
                if(doc.exists && doc.data().username !== snapshot.data().username) {
                    return db.doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().username,
                        sender: snapshot.data().username,
                        type: 'comment',
                        read: false,
                        postID: doc.id
                    });
                }
            }).catch((err) => {
                console.error(err);
        });
    });
// Usuń powiadomienie, gdy ktoś usunie polubienie
exports.deleteNotificationOnUnlike = functions.region('europe-west1').firestore.document('likes/{id}')
    .onDelete((snapshot) => {
        return db.doc(`/notifications/${snapshot.id}`).delete()
            .catch((err) => {
                console.error(err);
            });
    });

exports.onUserImageChange = functions.region('europe-west1').firestore.document('/users/{userId}')
    .onUpdate((change) => {
        if(change.before.data().profilePic !== change.after.data().profilePic) {
            const batch = db.batch();
            return db.collection('posts').where('username', '==', change.before.data().username).get()
                .then((data) => {
                    data.forEach((doc) => {
                        const post = db.doc(`/posts/${doc.id}`);
                        batch.update(post, { profilePic: change.after.data().profilePic });
                    });
                    return batch.commit();
                });
        } else return true;
    });

exports.onPostDeleted = functions.region('europe-west1').firestore.document('/posts/{postId}')
    .onDelete((snapshot, context) => {
        const postID = context.params.postID;
        const batch = db.batch();
        return db.collection('comments').where('postID', '==', postID).get()
            .then((data) => {
                data.forEach((doc) => {
                    batch.delete(db.doc(`/comments/${doc.id}`));
                    return db.collection('likes').where('postID', '==', postID).get();
                })
            }).then((data) => {
                data.forEach((doc) => {
                    batch.delete(db.doc(`/likes/${doc.id}`));
                    return db.collection('notifications').where('postID', '==', postID).get();
                })
            }).then((data) => {
                data.forEach((doc) => {
                    batch.delete(db.doc(`/notifications/${doc.id}`));
                    return batch.commit();
                })
            }).catch((err) => {
                console.error(err);
            })
    })