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
    // we're connected!
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
// if the user is authenticated
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
        res.render('homepage', { title: "Home", user: req.user });
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


app.get('/myclasses', isAuthenticated, function(req, res){
    res.render('myclasses', {user: req.user});
});

app.post('/addclass', function(req, res){
    var newClass = new Class();
    console.log(req.body);
    newClass.crn = req.body.crn;
    newClass.number = req.body.number;
    newClass.name = req.body.name;
    newClass.department = req.body.department;
    newClass.spots = 0;
    //console.log(newClass);
    req.user.classes.push(newClass);
    req.user.save(function(err){
        if(err)
            console.log(err);
        else
            console.log("saving user to db");
    });


    res.redirect('/myclasses');
});

app.delete('/deleteClass/:id', function(req, res) {
    //console.log(User);
    /*User.remove({ '_id' : classToDelete }, function(err) {
        res.send((err === null) ? { msg: '' } : { msg:'error: ' + err });
    });*/
    //console.log(req.user);
    req.user.classes.forEach(function(element){
       if(element._id == req.params.id){
           //console.log("test");
           req.user.classes.splice(req.user.classes.indexOf(element._id), 1);
       }
    });
    req.user.save(function(err){
        if(err) return res.send(err);
        return res.send(null);
    });


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




function checkAvailable(req) {
    var crn = req.crn;
    var number = req.number;
    console.log(crn);
    console.log(number);

    var settings = {
        "async": true,
        "crossDomain": true,
        "url": "https://ssb.cc.binghamton.edu/banner/bwskfcls.P_GetCrse_Advanced",
        "method": "POST",
        "headers": {
            "origin": "https://ssb.cc.binghamton.edu",
            "x-devtools-emulate-network-conditions-client-id": "9871bbf6-6719-4f39-b45e-3925370e2b3c",
            "upgrade-insecure-requests": "1",
            "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36",
            "content-type": "application/x-www-form-urlencoded",
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "referer": "https://ssb.cc.binghamton.edu/banner/bwckgens.p_proc_term_date",
            "accept-encoding": "gzip, deflate, br",
            "accept-language": "en-US,en;q=0.8",
            "cookie": "TESTID=set; _ga=GA1.2.239373860.1486495600; IDMSESSID=B00634552; SESSID=M003RFVFNjQ5MzUx; _ga=GA1.2.239373860.1486495600; IDMSESSID=B00634552"
        },
        "data": {
            "SUB_BTN": "Section Search",
            "begin_ap": "a",
            "begin_hh": "0",
            "begin_mi": "0",
            "crn": "dummy",
            "end_ap": "a",
            "end_hh": "0",
            "end_mi": "0",
            "path": "1",
            "rsts": "dummy",
            "sc_sel_attr": [
                "dummy",
                "%"
            ],
            "sel_attr": [
                "dummy",
                "%"
            ],
            "sel_camp": "dummy",
            "sel_crse": number,
            "sel_day": "dummy",
            "sel_from_cred": "",
            "sel_insm": [
                "dummy",
                "%"
            ],
            "sel_instr": "dummy",
            "sel_levl": [
                "dummy",
                "%"
            ],
            "sel_ptrm": [
                "dummy",
                "%"
            ],
            "sel_schd": [
                "dummy",
                "%"
            ],
            "sel_sess": "dummy",
            "sel_subj": [
                "dummy",
                "CS"
            ],
            "sel_title": "",
            "sel_to_cred": "",
            "term_in": "201720"


        }
    }
    /*console.log("checking availability of class");
    var re = new RegExp(crn + '(.*?\n){0,15} ', 'gm'); //hopefully this works?
    var output = re.exec(response);

    window.write(output);
    var re = new RegExp('(\d+?)<\/td>', 'gm');
    var answer = re.exec(output);

    var value = answer[5];*/
}





module.exports = app;
