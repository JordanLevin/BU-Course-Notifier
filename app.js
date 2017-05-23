var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var fs = require('fs');
var connect = require('connect');
//use flash to display messages
var flash = require('connect-flash');
var bCrypt = require('bcrypt-nodejs');
var request = require('request');
var async = require('async');
var nodemailer = require('nodemailer');

var app = express();

//internet guy said to do this
//app.disable('etag');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(flash());


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var mongoose = require('mongoose');
var opts = {
    server: {
        socketOptions: {keepAlive: 1}
    }
};
mongoose.connect('mongodb://jordan:realcsmajor@ds163758.mlab.com:63758/jordantest');

var db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    //connected
});

var User = require('./models/user.js').User;
var Class = require('./models/user.js').class;

//for sessions and stuff ---------------------------
var session = require('express-session');
var passport = require('passport');
app.use(session({secret: "secretstringthing"}));
app.use(passport.initialize());
app.use(passport.session());
//for sessions and stuff ---------------------------


var updateNumbers = function(){
    User.find({}, function(err, users){
        var check = [];
        users.forEach(function(user){ //go through every user in the db
            if (user.classes) {
                user.classes.forEach(function (c) { //go through every class in this user
                    check.push(function (callback) {
                        var results = [];
                        request('http://ssb.cc.binghamton.edu/banner/bwckschd.p_disp_detail_sched?term_in=201790&crn_in=' + c.crn, function (error, response, body) {
                            var re = new RegExp('dddefault">\\d+', 'g');
                            var nums = new RegExp('\\d\\d');
                            var xArray;
                            var first = true;
                            while (xArray = re.exec(body)) {
                                var test = xArray.toString().split(",")[0].split(">")[1];
                                if (!first)
                                    results.push(test);
                                first = false;
                            }
                            callback(null, results);
                        });
                    });
                });
            }
        });
        async.parallel(check, function (err, results) {
            var i = 0;
            users.forEach(function (user) {
                if(user.classes) {
                    user.classes.forEach(function (c) {
                        if(c.previousSpots != c.spots){
                            c.spotHistory.push(new Date(), c.spots);
                        }
                        c.previousSpots = c.spots;
                        c.spots = results[i][0];


                        if(user.notifications) {
                            if (c.spots !== c.previousSpots) {
                                notifyUsers(user.email, c.name, c.spots, c.previousSpots);
                            }
                        }
                        i++;
                    });
                }
                user.save(function (err) {
                    if (err) {
                        console.log('Error updating class: ' + err);
                        throw err;
                    }
                    console.log('Classes successfully updated');
                });
            });
        });
    });
}
//run update numbers every few minutes
setInterval(updateNumbers, 500000);

//send mail to a certain email with info about the class and spots given
function notifyUsers(email, name, spots, prev){
    console.log(email);
    var transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: 'webstuff987@gmail.com', // Your email id
            pass: 'passwordrequirementssuck' // Your password
        }
    });
    var options = {
        from: '"BU class notifier" <webstuff987@gmail.com>',
        to: email,
        subject: 'The number of spots available in ' + name + ' has changed',
        text: 'the number of spots in '+ name +' has changed from ' + prev + ' to ' + spots
    }

    transporter.sendMail(options, function(error, info){
        if (error) {
            return console.log(error);
        }
        console.log('Message %s sent: %s', info.messageId, info.response);
    });
}

passport.serializeUser(function(user, done){
    done(null, user._id);
});

passport.deserializeUser(function(id, done){
   User.findById(id, function(err, user){
       done(err, user);
   }) ;
});

var LocalStrategy   = require('passport-local').Strategy;
var isValidPassword = function(user, password){
    return bCrypt.compareSync(password, user.password);
}

//passport login stuff
passport.use('login', new LocalStrategy({
    passReqToCallback: true
},
    function(req, username, password, done){
    //check if user is in db
        User.findOne({'username' : username}, function(err, user){
           if(err)
               return done(err);
           //user doesnt exist
           if(!user){
               console.log("user " + " username does not exist");
               return done(null, false, req.flash('message', 'User Not found.'));
           }
           //user exist but wrong password
           if(!isValidPassword(user, password)){
               console.log('Invalid Password');
               return done(null, false, req.flash('message', 'Invalid Password'));
           }
           //info is correct, done is treated as success
           return done(null, user);

        }
    )

}));

// Generates hash using bCrypt
var createHash = function(password){
    return bCrypt.hashSync(password, bCrypt.genSaltSync(10), null);
}

//passport sign up stuff
passport.use('signup', new LocalStrategy({
        passReqToCallback : true
    },
    function(req, username, password, done) {
        findOrCreateUser = function(){
            // find a user in Mongo with provided username
            User.findOne({'username':username},function(err, user) {
                // In case of any error return
                if (err){
                    console.log('Error in SignUp: '+err);
                    return done(err);
                }
                // already exists
                if (user) {
                    console.log('User already exists');
                    return done(null, false,
                        req.flash('message','User Already Exists'));
                } else {
                    // if there is no user with that email
                    // create the user
                    var newUser = new User();
                    // set the user's local credentials
                    newUser.username = username;
                    newUser.password = createHash(password);
                    newUser.email = req.body.email;
                    newUser.firstName = req.body.firstName;
                    newUser.lastName = req.body.lastName;
                    newUser.notifications = false;

                    // save the user
                    newUser.save(function(err) {
                        if (err){
                            console.log('Error in Saving user: '+err);
                            throw err;
                        }
                        console.log('User Registration succesful');
                        return done(null, newUser);
                    });
                }
            });
        }

        // Delay the execution of findOrCreateUser and execute
        // the method in the next tick of the event loop
        process.nextTick(findOrCreateUser);
    }));

// check if the user is authenticated
var isAuthenticated = function (req, res, next) {
    if (req.isAuthenticated())
        return next();
    res.redirect('/signin');
};




app.get('/signin', function(req, res){
   res.render('index' ,{message: req.flash('message'), user: req.user})
});

/* GET home page. */
app.get('/', function(req, res) {
    // Display the Login page with any flash message, if any
    if(!req.user)
        res.render('index', { title: "BU Class Notifier", user: req.user });
    else
        res.redirect('/myclasses');
});

/* Handle Login POST */
app.post('/login', passport.authenticate('login', {
    successRedirect: '/home',
    failureRedirect: '/signin',
    failureFlash : true
}));

/* GET Registration Page */
app.get('/signup', function(req, res){
    res.render('register',{message: req.flash('message')});
});

/* Handle Registration POST */
app.post('/signup', passport.authenticate('signup', {
    successRedirect: '/home',
    failureRedirect: '/signup',
    failureFlash : true
}));

/* Handle Logout */
app.get('/signout', function(req, res) {
    req.logout();
    res.redirect('/');
});

app.get('/home', isAuthenticated, function(req, res){
    res.render('home', { user: req.user });
});


//stuff for checking classes --------------------------------------------------------------------------------------
app.get('/myclasses', isAuthenticated, function(req, res){
    var check = [];
    req.user.classes.forEach(function(c){
        check.push(function(callback) {
            var results = [];
            request('http://ssb.cc.binghamton.edu/banner/bwckschd.p_disp_detail_sched?term_in=201790&crn_in=' + c.crn, function (error, response, body) {
                var re = new RegExp('dddefault">\\d+', 'g');
                var nums = new RegExp('\\d\\d');
                var xArray;
                var first = true;
                while(xArray = re.exec(body)) {
                    var test = xArray.toString().split(",")[0].split(">")[1];
                    if(!first)
                        results.push(test);
                    first = false;
                }
                callback(null, results);
            });
        });
    });
    async.parallel(check, function(err, results){
        var i = 0;
        req.user.classes.forEach(function(c){
            console.log(c.name);

            if(c.previousSpots != c.spots){
                c.spotHistory.push(new Date(), c.spots);
            }
            c.previousSpots = c.spots;
            c.spots = results[i][0];
            i++;
            console.log(c.spots);
        });
            res.render('myclasses', {user: req.user});
    });






});


//add a new class to the list of classes being tracked
app.post('/addclass', function(req, res){
    valid = true;
    request('http://ssb.cc.binghamton.edu/banner/bwckschd.p_disp_detail_sched?term_in=201790&crn_in=' + req.body.crn, function (error, response, body) {
        var re = new RegExp('No detailed class information found');
        if(re.exec(body)){
            valid = false;
        }
        if(!valid){
            //invalid crn entered. notify user here later
            return res.redirect('/myclasses');
        }
        var newClass = new Class();
        console.log(req.body);
        newClass.crn = req.body.crn;
        newClass.name = req.body.name;
        newClass.spots = -10;
        newClass.spotHistory = []
        req.user.classes.push(newClass);
        req.user.save(function(err){
            if(err)
                console.log(err);
            else
                console.log("saving user to db");
            return res.redirect('/myclasses');
        });


    });

});


app.delete('/deleteClass/:id', function(req, res) {
    //go through list of classes
    for(var i = 0;i<req.user.classes.length ; i++){
       //check if the current class is the one to delete
       if(req.user.classes[i]._id == req.params.id){

           //splice it out of the array and save to db
           req.user.classes.splice(i, 1);
           req.user.save(function(err){
               if(err) return res.send(err);
               return res.send(null);
           });
       }
    }



});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


module.exports = app;
