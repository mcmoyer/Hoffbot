var Bot    = require('ttapi');
var raw_quotes = require("./quotes.js");
var raw_bop_responses = require("./bop_responses.js");
var settings = require('./settings.js');
var fs = require('fs');

var bot = new Bot(settings.auth, settings.userid, settings.roomid);

var default_motd = "Welcome to the 80's Time Capsule. We're glad you visited our room. Please visit our room info page to see a list of our rules. The link to it can be found in the room info tag at the top of the page. To leave the room, accelerate your DeLorean to 88 mph. :)";

var queue=[]
var moderators=[];
var current_quote = 0;
var current_bop_response = 0;
var is_bopping = false;

var quotes = shuffle(raw_quotes);
var bop_responses = shuffle(raw_bop_responses);


function isModerator(user_id) {
  return (moderators.indexOf(user_id) >= 0);
}

function blather() {
  phrase = quotes[current_quote];
  bot.speak(phrase);
  current_quote++;
  if (current_quote >= quotes.length) {
    quotes = shuffle(raw_quotes);
    current_quote = 0;
  }
}
function current_queue() {
  if (queue.length == 0)
    return "There is no queue or at least nobody has asked the Hoff for my permission lately"
  else {
    var message = "The Spinmaster order is: "
    for(user in queue) {
      message += queue[user] + ", ";
    }
    return message.slice(0,-2);
  }  
}
function position_in_queue(user) {
  var ret = -1;
  for(var i in queue) {
    if(user.toUpperCase() === queue[i].toUpperCase() ) {
      ret = i;
    }
  }
  return(ret);
}

function shuffle(array) {
  var tmp, current, top = array.length;

  if(top) while(--top) {
    current = Math.floor(Math.random() * (top + 1));
    tmp = array[current];
    array[current] = array[top];
    array[top] = tmp;
  }

  return array;
}

bot.on('registered', function (data) {
  if (data.user[0].userid != settings.userid) {
    bot.speak('Hello ' + data.user[0].name + ": " + motd);
  } else {
    bot.modifyProfile({name: "TheOneAndOnlyHoff"});
    bot.setAvatar(5);
    fs.readFile("current_queue.json", function(err,data) {
      if (err)
        queue = [];
      if (data)
        queue = JSON.parse(data.toString('utf8'));
    });
    fs.readFile("current_motd.json", function(err,data) {
      if (err)
        motd = default_motd;
      if (data)
        motd = data.toString('utf8');
    });
  }
  
});

bot.on('speak', function (data) {
   // Get the data
   var name = data.name;
   var text = data.text;

   // Respond to "/hello" command
   if (text.match(/^\/hello$/)) {
      bot.speak('Hey! How are you '+name+' ?');
   }

   if (text.match(/^\/set motd:/)) {
      if (isModerator(data.userid) ){
        motd = text.replace(/^\/set motd:\s*/,"");
        bot.speak("Gotcha boss!");
      } else {
        bot.speak("Hey KITT, we seem to have someone impersonating a moderator");
      }
   }

   if (text.match(/^\/motd/)) {
      bot.speak(motd);
   }

 
   if (text.match(/^What do you think Hoff/i)) {
     blather();
   }

  if (text.match(/^bop hoff/i)) {
    if (is_bopping) {
      bot.speak("If I bopped any harder, my head would fly off!");
      return
    }
    phrase = bop_responses[current_bop_response];
    current_bop_response++;
    if (current_bop_response >= bop_responses.length) {
      bop_responses = shuffle(raw_bop_responses);
      current_bop_response = 0;
    }
    bot.speak(phrase);
    bot.bop();
    is_bopping = true;
  }

  if (text.match(/^q[ue]* me hoff/i)) {
    if (queue.indexOf(name) >= 0) {
      bot.speak("Dude, you're already in the queue");
    } else {
      queue[queue.length] = name;
      bot.speak("Groovy!  Can't wait to hear what you're gonna spin");
    }
  }
 
  if (text.match(/^dq me hoff/i)) {
    if (queue.indexOf(name) >= 0) {
      bot.speak("Chicken....bock bock bock!");
      queue.splice(queue.indexOf(name),1);
    } else {
      bot.speak("Fairly certain you weren't in line...");
    }
  } 
  if (text.match(/^q[ue]*\?$/)) {
    bot.speak(current_queue())
  }

  if (text.match(/^step up hoff/i)) {
    bot.addDj();
  } 

  if (text.match(/^step down hoff/i)) {
    bot.remDj();
  }

  if (text.match(/^sleep hoff/i)) {
    if (isModerator(data.userid)) {
      fs.writeFile("current_queue.json", JSON.stringify(queue), function(err) {
        if (err)
          throw err;
      });
      fs.writeFile("current_motd.json", motd, function(err) {
        if (err)
          throw err;
      });
      bot.speak("I am kinda tired...It's been a long day being the Hoff");
    } else {
      bot.speak("You're not my momma!  I don't have to listen to you!")
    }

  }

  if (text.match(/^\/oust (.*)$/)) {
    if (isModerator(data.userid)) {
      var test = 1;
      var bad_user;
      bad_user = text.match(/^\/oust (.*)$/)[1];
      var i = position_in_queue(bad_user);
      if (i >=0) {  
        queue.splice(i,1);
        bot.speak("I agree.  I don't want to hear his music either, I'll remove him from the queue");
      } 
    } else {
      bot.speak("We've got a Napolean on our hands here.");
    } 
  }
  
  if (text.match(/love the hoff/i)) {
    bot.speak("Well, actually everybody loves me, but thanks for saying it out loud");
  }
 
  if (text.match(/manners hoff/i)) {
    bot.speak("Hey new DJs, just as a heads up, typically when people play songs that fit a theme (and especially if you're dj'ing) it's nice to awesome other people's songs. It's friendly, lets people know you're not afk, and encourages folks to awesome your songs, too.");
  }
});

bot.on('add_dj', function(data) {
  //check to see if the user is in the queue and remove them then
  dj = data.user[0].name;
  dj_index = queue.indexOf(dj);

  if (queue.length > 0) {
    if (dj_index == 0) {
      queue.splice(dj_index,1);
      bot.speak("Give it up for " + dj);
    } else {
      bot.speak("HEY! " + dj + ", we don't like it when people cut in line around here! - " + queue[0] + " is up next so please step down")
    } 
  }
});

bot.on("deregistered", function(data) {
  dj = data.user[0].name;
  i = position_in_queue(dj);
  if (i>=0) {
    queue.splice(i,1);
  }
});

bot.on('newsong', function (data) {
  moderators=data.room.metadata.moderator_id;
  song = data.room.metadata.current_song;
  is_bopping = false;
  if (song.metadata.artist.match(/hasselhoff/i)) {
    bot.speak(song.djname + ", you have impecable taste! You, my friend, deserve an 'Awesome' for this gem of a song");
    bot.bop();
  }
});

bot.on("rem_dj", function (data) {
  if (queue.length > 0) {
    bot.speak("Hey " + queue[0] + ", it's your turn on the DJ stand!")
  }
});
