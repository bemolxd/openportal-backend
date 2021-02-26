const { admin, db } = require("./admin");

module.exports = (req, res, next) => {
    let idToken;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
        console.log("Nie znaleziono tokenu"); 
        return res.status(403).json({ error: "Nie autoryzowano" });
    }

    admin.auth().verifyIdToken(idToken).then((decodedToken) => {
        req.user = decodedToken;
        return db.collection('users').where('userID', '==', req.user.uid).limit(1).get();
    }).then((data) => {
        req.user.username = data.docs[0].data().username;
        req.user.profilePic = data.docs[0].data().profilePic;
        return next();
    }).catch((err) => {
        console.error("Błąd podczas weryfikacji tokenu ", err);
        return res.status(403).json(err)
    })
};