var mongoose = require('mongoose');

var classesSchema = new mongoose.Schema({
    crn: String,
    name: String,
    number: String,
    department: String,
    spots: Number

});

var userSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: String,
    username: String,
    password: String,
    notifications: Boolean,
    classes : [classesSchema]

});

//var User = mongoose.model('User2', userSchema);
module.exports = {
    class: mongoose.model('classes', classesSchema),
    User: mongoose.model('User2', userSchema)
};
