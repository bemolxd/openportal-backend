const isEmpty = (string) => {
    if(string.trim() === '') return true;
    else return false;
};

const isEmail = (email) => {
    const emailRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

    if(email.match(emailRegEx)) return true;
    else return false;
};

exports.validateAtSignUp = (data) => {
    let errors = {};

    if(isEmpty(data.email)) {
        errors.email = "Nie moze byc pusty!";
    } else if(!isEmail(data.email)) {
        errors.email = "Nieprawidlowy format!"
    }

    if(isEmpty(data.password)) errors.password = "Nie moze byc pusty!"
    if(isEmpty(data.username)) errors.username = "Nie moze byc pusty!"
    if(data.password !== data.confirmPassword) errors.password = "Hasła muszą się zgadzać!"

    return {
         errors, 
         valid: Object.keys(errors).length === 0 ? true : false
    }
};

exports.validateAtLogIn = (data) => {
    let errors = {};

    if(isEmpty(data.email)) errors.email = "Nie moze być pusty!"
    if(isEmpty(data.password)) errors.password = "Nie moze być pusty!"

    return {
        errors, 
        valid: Object.keys(errors).length === 0 ? true : false
   }
};

exports.reduceUserDetails = (data) => {
    let userDetails = {};

    if(!isEmpty(data.bio.trim())) userDetails.bio = data.bio;
    if(!isEmpty(data.website.trim())) {
        if(data.website.trim().substring(0, 4) !== "http"){
            userDetails.website = `http://${data.website.trim()}`;
        } else userDetails.website = data.website;
    }
    if(!isEmpty(data.location.trim())) userDetails.location = data.location;

    return userDetails;
}