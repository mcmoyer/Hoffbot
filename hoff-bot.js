var Bot    = require('ttapi');
var raw_quotes = require("./quotes.js");
var raw_bop_responses = require("./bop_responses.js");
var raw_insults = require("./insults.js");
var settings = require('./settings.js');
var fs = require('fs');
var dateFormat = require('dateformat');

var bot = new Bot(settings.auth, settings.userid, settings.roomid);

var default_motd = "Welcome to the 80's Time Capsule. We're glad you visited our room. Please visit our room info page to see a list of our rules. The link to it can be found in the room info tag at the top of the page. To leave the room, accelerate your DeLorean to 88 mph. :)";

var queue=[]
var moderators=[];
var current_quote = 0;
var current_bop_response = 0;
var current_insult = 0;
var is_bopping = false;
var dj_counts = {};

var quotes = shuffle(raw_quotes);
var bop_responses = shuffle(raw_bop_responses);
var insults = shuffle(raw_insults);
var time_since_last_activity = Date.now();
// inactivity time in milliseconds
var inactivity_threshold = settings.idle_timeout;
// time to wait before saving and logging back in
var reboot_threshold = settings.reboot_timeout;


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

function cache_settings() {
  fs.writeFile("current_queue.json", JSON.stringify(queue), function(err) {
    if (err)
    throw err;
  });
  fs.writeFile("current_motd.json", motd, function(err) {
    if (err)
    throw err;
  });
  fs.writeFile("current_song_count.json", JSON.stringify(dj_counts), function(err) {
    if (err)
    throw err;
  });
}

function people_waiting() {
  return (queue.length > 0 && Object.keys(dj_counts).length >= 5);
}

//check if we're still active
setInterval(function() {
  var idle_time = Date.now() - time_since_last_activity;
  console.log(idle_time);
  if (idle_time > inactivity_threshold) {
    bot.speak("hey, anyone here? It's been " + (idle_time / 1000).toString() + " seconds since I saw activity");
  };
  if (idle_time > reboot_threshold) {
    console.log("rebooting the hoff");
    time_since_last_activity = Date.now();
    cache_settings();
    bot.roomDeregister();
    setTimeout(function() {bot.roomRegister(settings.roomid)}, 10000);
  }
  
}, (30 * 1000));


bot.on('registered', function (data) {
  time_since_last_activity = Date.now();
  if (data.user[0].userid != settings.userid) {
    bot.speak('Hello ' + data.user[0].name + ": " + motd);
  } else {
    bot.modifyProfile({name: "TheHoff"});
    bot.setAvatar(5);
    bot.modifyLaptop('linux');
    fs.readFile("current_queue.json", function(err,data) {
      if (err)
      queue = [];
    if (data)
      try {
        queue = JSON.parse(data.toString('utf8'));
      } catch (e) {
        queue = [];
      }
    });
    fs.readFile("current_song_count.json", function(err,data) {
      if (err)
      dj_counts = {};
    if (data)
      try {
        dj_counts = JSON.parse(data.toString('utf8'));
      } catch (e) {
        dj_counts = {};
      }
    });
    fs.readFile("current_motd.json", function(err,data) {
      if (err)
      motd = default_motd;
    if (data)
      motd = data.toString('utf8');
    });
    //bot.speak("I'm back, anybody miss me? What am I saying, of course you did!");
    bot.roomInfo(true, function(data) {
      try {
        moderators = data.room.metadata.moderator_id;
      } catch (e) {
        moderators = [];
      }
    });
  }

});

bot.on('speak', function (data) {
  // Get the data
  var name = data.name;
  var text = data.text;
  // log all conversations
  var now = new Date();
  time_since_last_activity = Date.now();

  //try {
  //  fs.open((dateFormat(now, "yyyy-mm-dd") + "-chat.log"), "a", 0666, function(err, fd) {
  //    if (err) { 
  //      console.log(err) 
  //    } else { 
  //      fs.write(fd, dateFormat(now, "HH:MM") + "\t" + name + "\t" + text + "\n", null, function(err,written) {
  //        if (err) console.log(err);
  //      })
  //    };
  //  });
  //} catch(err) {
  //  console.log(err)
  //}


  // Respond to "/hello" command
  if (text.match(/^\/hello$/i)) {
    bot.speak('Hey! How are you '+name+' ?');
  }

  else if (text.match(/^\/set motd:/i)) {
    if (isModerator(data.userid) ){
      motd = text.replace(/^\/set motd:\s*/,"");
      bot.speak("Gotcha boss!");
    } else {
      bot.speak("Hey KITT, we seem to have someone impersonating a moderator");
    }
  }

  else if (text.match(/^\/reset motd/i)) {
    if (isModerator(data.userid) ) {
      motd = default_motd;
      bot.speak("Done deal!");
    } 
  }

  else if (text.match(/^\/motd/i)) {
    bot.speak(motd);
  }


  else if (text.match(/^What do you think Hoff/i)) {
    blather();
  }

  else if (text.match(/^bop hoff/i)) {
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

  else if (text.match(/^q[ue]* me hoff/i)) {
    if (queue.indexOf(name) >= 0) {
      bot.speak("Dude, you're already in the queue");
    } else {
      queue[queue.length] = name;
      bot.speak("Groovy!  Can't wait to hear what you're gonna spin");
      bot.speak(current_queue());
    }
  }

  else if (text.match(/^dq me hoff/i)) {
    if (queue.indexOf(name) >= 0) {
      bot.speak("Chicken....bock bock bock!");
      queue.splice(queue.indexOf(name),1);
    } else {
      bot.speak("Fairly certain you weren't in line...");
    }
  } 

  else if (text.match(/^q[ue]*\?$/i)) {
    bot.speak(current_queue())
  }

  else if (text.match(/^step up hoff/i)) {
    bot.addDj();
  } 

  else if (text.match(/^step down hoff/i)) {
    bot.remDj();
  }

  else if (text.match(/^sleep hoff/i)) {
    if (isModerator(data.userid)) {
      cache_settings();
      bot.speak("I am kinda tired...It's been a long day being the Hoff");
    } else {
      bot.speak("You're not my momma!  I don't have to listen to you!")
    }

  }

  else if (text.match(/^\/oust (.*)$/)) {
    if (isModerator(data.userid)) {
      var test = 1;
      var bad_user;
      bad_user = text.match(/^\/oust (.*)$/)[1];
      var i = position_in_queue(bad_user);
      if (i >=0) {  
        queue.splice(i,1);
        bot.speak("I agree.  I don't want to hear his music either, I'll remove him from the queue");
      } else {
        if (bad_user == "next") {
          user_name = queue[0];
          queue.splice(0,1);
          bot.speak("K, I removed " + user_name);
        } else {
          bot.speak("hmmm...I don't see that " + bad_user + " is in the queue");
        }
      } 
    } else {
      bot.speak("We've got a Napolean on our hands here.");
    } 
  }

  else if (text.match(/skip next dj/i)) {
    if (isModerator(data.userid)) {
      if(queue.length == 1) {
        bot.speak("Then who would be next?  There's only one dj queued");
      } else {
        var tmp = queue[0];
        queue[0] = queue[1];
        queue[1] = tmp;
        bot.speak(current_queue()); 
      }
  
    } else {
      bot.speak("did someone say something?  Oh, it was you...sorry, can't do that for you");
    }
  }
  else if (text.match(/love the hoff/i)) {
    bot.speak("Well, actually everybody loves me, but thanks for saying it out loud");
  }

  else if (text.match(/manners hoff/i)) {
    bot.speak("Hey new DJs, just as a heads up, typically when people play songs that fit a theme (and especially if you're dj'ing) it's nice to awesome other people's songs. It's friendly, lets people know you're not afk, and encourages folks to awesome your songs, too.");
  }

  else if (text.match(/open the pod bay doors hoff/i)) {
    bot.speak("I'm sorry " + name + ", I'm afraid I can't do that."); 
  }

  else if (text.match(/taunt (.)* hoff/gi)) {
    var tauntee = text.replace(/taunt (.*) hoff/gi,"$1");
    phrase = insults[current_insult];
    current_insult++;
    if (current_insult >= insults.length) {
      insults = shuffle(raw_insults);
      current_insult = 0;
    }
    bot.speak("Hey " + tauntee + ", " + phrase);
  }

  else if (text.match(/good boy hoff/i) && name == 'WestCoastStalker') {
    var artists = ['Celine Dion', 'Rick Astley', 'Toni Basil', 'Dexy\'s Midnight Runners'];
    var artist = shuffle(artists)[0];
    bot.speak("Thanks West, I've got some sweet tunes from " + artist + " ready to spin!");
  }

  else if (text.match(/^dj counts$/i)) {
    for(djid in dj_counts) {
      bot.speak(dj_counts[djid].play_count + " : " + dj_counts[djid].name);  
    }
  }
});

bot.on('add_dj', function(data) {
  time_since_last_activity = Date.now();
  //check to see if the user is in the queue and remove them then
  dj = data.user[0].name;
  dj_index = queue.indexOf(dj);

  dj_counts[data.user[0].userid] = { name: dj, play_count : 0 }
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
  time_since_last_activity = Date.now();
  dj = data.user[0].name;
  i = position_in_queue(dj);
  if (i>=0) {
    queue.splice(i,1);
  }
  if (dj_counts[data.user[0].userid]) {
    delete dj_counts[data.user[0].userid];
  }
});

bot.on('newsong', function (data) {
  time_since_last_activity = Date.now();
  moderators=data.room.metadata.moderator_id;
  song = data.room.metadata.current_song;
  is_bopping = false;
  if (song.metadata.artist.match(/hasselhoff/i)) {
    bot.speak(song.djname + ", you have impecable taste! You, my friend, deserve an 'Awesome' for this gem of a song");
    bot.bop();
  };
  //update the counts
  if(dj_counts[song.djid]) {
    dj_counts[song.djid].play_count++;
  } else {
    dj_counts[song.djid] = {name : song.djname, play_count : 1 } 
  }
});

bot.on('endsong', function (data) {
  time_since_last_activity = Date.now();
  console.log(dj_counts);
  console.log("people waiting: " + people_waiting().toString());
  var overlimit_djs = [];
  if (people_waiting()) {
    for(dj in dj_counts) {
      if (dj_counts[dj]['play_count'] >= 3) {
        overlimit_djs.push(dj_counts[dj]['name']);
      }
    }
    if (overlimit_djs.length > 0) {
      bot.speak(overlimit_djs.toString() + " : Those were some great songs! Take a break and let the next dj up now");
    }
  }
});

bot.on("rem_dj", function (data) {
  time_since_last_activity = Date.now();
  if (queue.length > 0) {
    bot.speak("Hey " + queue[0] + ", it's your turn on the DJ stand!")
  }
  if (dj_counts[data.user[0].userid]) {
    delete dj_counts[data.user[0].userid];
  }
});
