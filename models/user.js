var mongoose = require('mongoose');

var classesSchema = new mongoose.Schema({
    crn: String,
    name: String,
    spots: Number,
    previousSpots: Number,
    semester: Number,
    spotHistory: [Date, Number]

});

var userSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: String,
    username: String,
    password: String,
    notifications: Boolean,
    classes : [classesSchema],

});

module.exports = {
    class: mongoose.model('classes', classesSchema),
    User: mongoose.model('User2', userSchema)
};
