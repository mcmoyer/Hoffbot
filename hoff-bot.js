const dotenv = require('dotenv');
dotenv.config();
const Bot = require('ttapi')
const fs = require('fs')
const dateFormat = require('dateformat')
const Util = require('./util.js')

const raw_quotes = require("./quotes.js")
const raw_bop_responses = require("./bop_responses.js")
const raw_insults = require("./insults.js")
const add_dj_responses = require("./dj_responses.js")

const bot = new Bot(process.env.hoffbot_auth, process.env.hoffbot_userid, process.env.hoffbot_roomid)

const default_motd = "Welcome to the 80's Time Capsule.Type \"q me Hoff\" to be added to the queue. For room rules, visit the link in the \"Room Info\" tab."

let queue = []
let moderators = []
let current_quote = 0
let current_bop_response = 0
let current_insult = 0
let is_bopping = false
let dj_counts = {}
let max_djs = 0
let recent_visitors = {}
let current_dj = ""
let current_dj_list = []
let djs = {}
let should_autobop = false
let autobopTimer = null
const autobotTimeout = 3600 * 1000 // 1 hour

let quotes = Util.shuffle(raw_quotes)
let bop_responses = Util.shuffle(raw_bop_responses)
let insults = Util.shuffle(raw_insults)

let time_since_last_activity = Date.now()
// inactivity time in milliseconds
const inactivity_threshold = process.env.hoffbot_idle_timeout
// time to wait before saving and logging back in
const reboot_threshold = process.env.hoffbot_reboot_timeout

console.log("started");
bot.debug = false;

function isModerator(user_id) {
  return (moderators.indexOf(user_id) >= 0);
}

function blather() {
  phrase = quotes[current_quote];
  bot.speak(phrase);
  current_quote++;
  if (current_quote >= quotes.length) {
    quotes = Util.shuffle(raw_quotes);
    current_quote = 0;
  }
}
function current_queue() {
  if (queue.length === 0)
    return "There is no queue or at least nobody has asked the Hoff for my permission lately";
  else {
    let message = "The Spinmaster order is: "
    queue.forEach(function(user) { message += `${user}, `; });
    return message.slice(0,-2);
  }  
}
function position_in_queue(user) {
  return queue.map(function(i) { return i.toUpperCase();}).indexOf(user.toUpperCase());
}

function cache_settings() {
  cache_queue();
  cache_motd();
  cache_song_count();
}

function cache_queue() {
  fs.writeFile("current_queue.json", JSON.stringify(queue), function(err) {
    if (err)
    throw err;
  });
}

function cache_motd() {
  fs.writeFile("current_motd.json", motd, function(err) {
    if (err)
    throw err;
  });
}

function cache_song_count() {
  fs.writeFile("current_song_count.json", JSON.stringify(dj_counts), function(err) {
    if (err)
    throw err;
  });
}

function people_waiting() {
  return (queue.length > 0 && Object.keys(dj_counts).length >= 5);
}

function dj_spot_available() {
  return (Object.keys(dj_counts).length < max_djs);
}

function stub_out_dj_spots(current_djs) {
  let dj_id
  console.log(current_djs);
  console.log(dj_counts);
  current_djs.forEach(function(dj_id) {
    if (dj_counts[dj_id] === undefined) {
      dj_counts[dj_id] = { name: 'not sure', play_count: 0 };
    }
  });
  for(dj_id in dj_counts) {
    console.log(current_djs.indexOf(dj_id));
    if (current_djs.indexOf(dj_id) === -1) {
      delete dj_counts[dj_id];
    }
  }
}

function fill_in_djs(dj_list) {
  console.log(dj_list);
  dj_list.forEach(function(dj) {
    if(djs[dj.userid]) {
      djs[dj.userid].last_bop = Date.now();
    } else {
      djs[dj.userid] = {"name" : dj.name, "last_bop": Date.now() };
    }
  });
}

function update_last_bop(user) {
  if(djs[user.userid]) {
    djs[user.userid].last_bop = Date.now();
  }
}

function format_name(dj_name) {
  if(dj_name === null) {
    return 'someone there?';
	} else if(dj_name[0] === '@') {
    return dj_name;
  } else {
    return `@${dj_name}`;
  }
}

function minutes_ago(minutes) {
  return (Date.now() - (minutes * 60 * 1000));
}

const startAutobop = () => {
  bot.speak("Ok, I might as well be bopping if I'm going to be standing here");
  should_autobop = true;
  autobopTimer = setTimeout(() => {
    should_autobop = false;
  }, autobotTimeout)
};

const stopAutobop = () => {
  bot.speak("Ok, stopping the bopping...killjoy");
  should_autobop = false;
  clearTimeout(autobopTimer);
}

//check if we're still active
setInterval(function() {
  const idle_time = Date.now() - time_since_last_activity
  if (idle_time > inactivity_threshold) {
    bot.speak(`hey, anyone here? It's been ${(idle_time / 1000).toString()} seconds since I saw activity`);
  }
  if (idle_time > reboot_threshold) {
    console.log("rebooting the hoff");
    time_since_last_activity = Date.now();
    cache_settings();
    bot.roomDeregister();
    setTimeout(function() {bot.roomRegister(process.env.hoffbot_roomid);}, 10000);
  }
  
}, (30 * 1000));

//check the dj stand to make sure they're still there
setInterval(function() {
  current_dj_list.forEach(function(dj_id) {
    dj = djs[dj_id];
    console.log(`${dj.name} last bopped at ${dateFormat(dj.last_bop, "HH:MM:ss")}`);
    if(minutes_ago(10) > dj.last_bop) {
      //bot.speak("Hey " + format_name(dj.name) + ", this is your final notice.  You will be escorted down");
      console.log(`${dj.name} is over 10 minutes`);
    } else if ((minutes_ago(8) > dj.last_bop) && (dj.last_bop > minutes_ago(9))) {
      //bot.speak("Hey " + format_name(dj.name) + ", are you there...HELLO, are we receiving?");
      console.log(`${dj.name} is over 8 minutes`);
    } else if ((minutes_ago(5) > dj.last_bop) && (dj.last_bop > minutes_ago(6))) {
      //bot.speak("Hey " + format_name(dj.name) + ", we don't like AFK dj'ing.  Please press your 'Awesome' button to let us know you're there");
      console.log(`${dj.name} is over 5 minutes`);
    }
  });  
}, (60 * 1000));

bot.on('registered', function (data) {
  time_since_last_activity = Date.now();
  if (data.user[0].userid !== process.env.hoffbot_userid) {
    const user = data.user[0]
    djs[user.userid] = {"name": user.name, "last_bop" : time_since_last_activity };
    if(recent_visitors[user.userid]) { 
      if(Date.now() - recent_visitors[user.userid] > (1000 * 60 * 30)) {
        bot.speak(`Hello ${format_name(user.name)}: ${motd}`);
      } else {
        console.log(`user must have refreshed - ${user.name}`);
      }
    } else if (user.name.match(/_west\d*/)) {
      //bot.speak("Hi " + data.user[0].name);
    } else if (user.name.match(/ttstats|ttdashboard/)) { 
      // don't do a thing
      console.log('tt bot');
    } else {
      bot.speak(`Hello ${format_name(user.name)}: ${motd}`);
    }
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
        max_djs = data.room.metadata.max_djs;
        moderators = data.room.metadata.moderator_id;
        fill_in_djs(data.users);
        stub_out_dj_spots(data.room.metadata.djs);
        current_dj_list = data.room.metadata.djs;
      } catch (e) {
        moderators = [];
      }
    });
  }

});

bot.on('speak', function (data) {
  // Get the data
  const name = data.name
  const text = data.text
  const dj_id = data.userid
  // log all conversations
  time_since_last_activity = Date.now();

  console.log(Util.rpad(dateFormat(time_since_last_activity, "HH:MM" ),6) + Util.rpad(name,20) + text);

  /**
   * Respond to hello
   */
  // Respond to "/hello" command
  if (text.match(/^\/hello$/i)) {
    bot.speak(`Hey! How are you ${format_name(name)} ?`);
  }

  /**
   * Respond to an insult
   */
  else if (text.match(/fu[c]*k you hoff/i)) {
    bot.speak("I'm rubber and you're glue, whatever you say bounces off me and sticks to you!");
  }

  /**
   * /set motd: <message>
   *
   * replaces the current message of the day with <message>
   */
  else if (text.match(/^\/set motd:/i)) {
    if (isModerator(data.userid) ){
      motd = text.replace(/^\/set motd:\s*/,"");
      bot.speak("Gotcha boss!");
      cache_motd();
    } else {
      bot.speak("Hey KITT, we seem to have someone impersonating a moderator");
    }
  }

  /**
   * /reset motd
   *
   * reset the motd back to the default
   */
  else if (text.match(/^\/reset motd/i)) {
    if (isModerator(data.userid) ) {
      motd = default_motd;
      bot.speak("Done deal!");
    } 
  }

  /**
   * /motd
   *
   * reads the message of the day
   */
  else if (text.match(/^\/motd/i)) {
    bot.speak(motd);
  }

  /**
   * What do you think Hoff
   *
   * Hoffbot will respond with a random quote
   */
  else if (text.match(/^What do you think Hoff/i)) {
    blather();
  }

  /**
   * bop hoff
   *
   * Will make Hoffbot like the current song and bop to it.
   * Hoffbot will not allow someone to make him bop to their own song
   */
  else if (text.match(/^bop hoff/i)) {
    if (current_dj === data.userid) {
      bot.speak("I'm really sorry, but I can't help you self gratify yourself");
    } else {
      if (is_bopping) {
        bot.speak("If I bopped any harder, my head would fly off!");
        return false;
      }
      phrase = bop_responses[current_bop_response];
      current_bop_response++;
      if (current_bop_response >= bop_responses.length) {
        bop_responses = Util.shuffle(raw_bop_responses);
        current_bop_response = 0;
      }
      bot.speak(phrase);
      bot.bop();
      is_bopping = true;
    }
  }

  /**
   * que me hoff
   * q me hoff
   *
   * places the user in the dj queue
   */
  else if (text.match(/^q[ue]* me hoff/i)) {
    if (queue.indexOf(name) >= 0) {
      bot.speak("Dude, you're already in the queue");
    } else if(dj_counts[dj_id]) {
      bot.speak("Do you not realize where you are?  Maybe next time try to not be on the dj stand when you queue yourself!");
    } else {
      queue[queue.length] = name;
      bot.speak("Groovy!  Can't wait to hear what you're gonna spin");
      if (dj_spot_available() && (queue.length === 1)) {
        bot.speak(`go ahead ${format_name(name)} and hop up - seat's all yours`);
      } else {
        bot.speak(current_queue());
      }
      cache_queue();
    }
  }

  /**
   * dq me hoff
   *
   * removes the user from the dj queue
   */
  else if (text.match(/^dq me hoff/i)) {
    if (queue.indexOf(name) >= 0) {
      bot.speak("Chicken....bock bock bock!");
      queue.splice(queue.indexOf(name),1);
      cache_queue();
    } else {
      bot.speak("Fairly certain you weren't in line...");
    }
  }

  /**
   * que?
   * q?
   *
   * displays the current dj queue
   */
  else if (text.match(/^q[ue]*\?$/i)) {
    bot.speak(current_queue());
  }

  /**
   * step up hoff
   *
   * Hoff will hop up on the dj stand and start spinning
   */
  else if (text.match(/^step up hoff/i)) {
    bot.addDj();
  }

  /**
   * step down hoff
   *
   * Hoff will hop down from the dj stand
   */
  else if (text.match(/^step down hoff/i)) {
    bot.remDj();
  }

  /**
   * sleep hoff
   *
   * Hoff will save the current settings.  Useful for retaining state between restarts of hoffbot
   */
  else if (text.match(/^sleep hoff/i)) {
    if (isModerator(data.userid)) {
      cache_settings();
      bot.speak("I am kinda tired...It's been a long day being the Hoff");
    } else {
      bot.speak("You're not my momma!  I don't have to listen to you!");
    }

  }

  /**
   * /oust <user>
   * /oust next
   *
   * removes a user from the dj queue
   * if 'next' is specified, removes the next (first user) in the dj queue.
   */
  else if (text.match(/^\/oust (.*)$/)) {
    if (isModerator(data.userid)) {
      let bad_user
      bad_user = text.match(/^\/oust (.*)$/)[1];
      const i = position_in_queue(bad_user)
      if (i >=0) {  
        queue.splice(i,1);
        bot.speak("I agree.  I don't want to hear his music either, I'll remove him from the queue");
      } else {
        if (bad_user === "next") {
          user_name = queue[0];
          queue.splice(0,1);
          bot.speak(`K, I removed ${user_name}`);
        } else {
          bot.speak(`hmmm...I don't see that ${bad_user} is in the queue`);
        }
      } 
      cache_queue();
    } else {
      bot.speak("We've got a Napolean on our hands here.");
    } 
  }

  /**
   * skip next dj
   *
   * removes next dj from the queue.
   */
  else if (text.match(/skip next dj/i)) {
    if (isModerator(data.userid)) {
      if(queue.length === 1) {
        bot.speak("Then who would be next?  There's only one dj queued");
      } else {
        const tmp = queue[0]
        queue[0] = queue[1];
        queue[1] = tmp;
        bot.speak(current_queue()); 
        cache_queue();
      }
    } else {
      bot.speak("did someone say something?  Oh, it was you...sorry, can't do that for you");
    }
  }

  /**
   * love the hoff
   *
   * accepts love from his fans
   */
  else if (text.match(/love the hoff/i)) {
    bot.speak("Well, actually everybody loves me, but thanks for saying it out loud");
  }

  /**
   * move next dj to last
   *
   * moves the next dj in the queue to the last spot
   */
  else if (text.match(/move next dj to last/i)) {
    if (isModerator(data.userid)) {
      if(queue.length === 1) {
        bot.speak("ummm, ok...voila! They are now at the end of the 1 person queue.");
      } else {
        first_dj = queue.shift();
        queue.push(first_dj);
        bot.speak(current_queue());
        cache_queue();
      }
    }
  }

  /**
   * forget the counts hoff
   *
   * resets the song counts for the djs on the dj stand.
   */
  else if (text.match(/forget the counts hoff/)) {
    if (isModerator(data.userid)) {
      dj_counts = {};
      bot.speak("I haven't heard anyone play anything...hey who are those guys on the dj stand?");
    } else {
      bot.speak("Nice try Mr. Nobody");
    }
  }

  /**
   * manners hoff
   *
   * replies with our common manners for the room
   */
  else if (text.match(/manners hoff/i)) {
    bot.speak("Hey new DJs, just as a heads up, typically when people play songs that fit a theme (and especially if you're dj'ing) it's nice to awesome other people's songs. It's friendly, lets people know you're not afk, and encourages folks to awesome your songs, too.");
  }

  /**
   * open the pod bay doors hoff
   *
   * he wouldn't open the pod bay doors even if there were some
   */
  else if (text.match(/open the pod bay doors hoff/i)) {
    bot.speak(`I'm sorry @${name}, I'm afraid I can't do that.`);
  }

  /**
   * taunt <user> hoff
   *
   * throws a random insult directed at the <user>
   */
  else if (text.match(/taunt (.)* hoff/gi)) {
    const tauntee = text.replace(/taunt (.*) hoff/gi, "$1")
    phrase = insults[current_insult];
    current_insult++;
    if (current_insult >= insults.length) {
      insults = Util.shuffle(raw_insults);
      current_insult = 0;
    }
    bot.speak(`Hey ${format_name(tauntee)}, ${phrase}`);
  }

  /**
   * good boy hoff
   *
   * If West tells him this, he'll respond with a quip
   */
  else if (text.match(/good boy hoff/i) && name === 'WestCoastStalker') {
    const artists = ['Celine Dion', 'Rick Astley', 'Toni Basil', 'Dexy\'s Midnight Runners']
    const artist = Util.shuffle(artists)[0]
    bot.speak(`Thanks West, I've got some sweet tunes from ${artist} ready to spin!`);
  }

  /**
   * dj counts
   *
   * shows the current song played counts for the djs on the stand
   */
  else if (text.match(/^dj counts$/i)) {
    let djid
    let index = 0
    for(djid in dj_counts) {
      //bot.speak(dj_counts[djid].play_count + " : " + dj_counts[djid].name);  
      const message = (`${dj_counts[djid].play_count} : ${dj_counts[djid].name}`)
      setTimeout(function(dj) { bot.speak(dj); }, index * 750, message);
      index++;
    }
  }

  /**
   * there is no que hoff
   * there is no q hoff
   *
   * empties the current dj queue
   */
  else if (text.match(/^there is no q[ue]* hoff$/i)) {
    if (isModerator(data.userid)) {
      bot.speak("These are not the dj's I'm looking for...");
      queue = [];
      cache_queue();
    } else {
      bot.speak("Your Jedi mind tricks will not work with me!");
    }
  }

  /**
   * transform hoff
   *
   * transformer hoff.
   */
  else if (text.match(/^transform hoff$/i)) {
    bot.speak("eep oork wronk wronk....done");
  }

  /**
   * autobop on hoff
   *
   * starts hoff autobopping to all songs
   */
  else if (text.match(/^autobop on hoff$/i)) {
    startAutobop()
  }

  /**
   * autobop off hoff
   *
   * stops hoff's autobopping
   */
  else if (text.match(/^autobop off hoff$/i)) {
    stopAutobop()
  }
});

bot.on('add_dj', function(data) {
  time_since_last_activity = Date.now();
  //check to see if the user is in the queue and remove them then
  user = data.user[0];
  
  dj = user.name;
  dj_index = queue.indexOf(dj);
  current_dj_list.push(user.userid);
  console.log("add_dj function");
  console.log(user); 
  dj_counts[user.userid] = { name: dj, play_count : 0 };
  if (queue.length > 0) {
    if (dj_index === 0) {
      queue.splice(dj_index,1);
      if (add_dj_responses[user.userid]) {
        bot.speak(add_dj_responses[user.userid]);
      } else {
        bot.speak(`Give it up for ${format_name(dj)}` );
      }
      cache_queue();
      update_last_bop(user);
    } else {
      bot.speak(`HEY! ${format_name(dj)}, we don't like it when people cut in line around here! - ${format_name(queue[0])} is up next so please step down`);
    } 
  }
});

bot.on("deregistered", function(data) {
  time_since_last_activity = Date.now();
  user = data.user[0];
  dj = user.name;
  i = position_in_queue(dj);
  if (i>=0) {
    queue.splice(i,1);
    cache_queue();
  }
  if (dj_counts[user.userid]) {
    delete dj_counts[user.userid];
    cache_song_count();
  }
  recent_visitors[user.userid] = Date.now();
  delete djs[user.userid];
  dj_idx = current_dj_list.indexOf(user.userid);
  if (dj_idx >= 0)
    current_dj_list.splice(dj_idx,1);
});

bot.on('newsong', function (data) {
  time_since_last_activity = Date.now();
  moderators=data.room.metadata.moderator_id;
  song = data.room.metadata.current_song;
  is_bopping = false;
  if (song.metadata.artist.match(/hasselhoff/i)) {
    bot.speak(`${format_name(song.djname)}, you have impecable taste! You, my friend, deserve an 'Awesome' for this gem of a song`);
    bot.bop();
  }
  if (should_autobop) {
    bot.bop();
  }
  //update the counts
  current_dj = song.djid;
  if(dj_counts[song.djid]) {
    dj_counts[song.djid].play_count++;
    dj_counts[song.djid].name = song.djname;
  } else {
    dj_counts[song.djid] = {name : song.djname, play_count : 1 }; 
  }
  cache_song_count();
  current_dj_list = data.room.metadata.djs;
  console.log(`${Util.rpad(dateFormat(time_since_last_activity, "HH:MM"), 6) + Util.rpad(song.djname, 20)}Started playing: ${song.metadata.song} - by: ${song.metadata.artist}`);

});

bot.on('endsong', function (_data) {
  time_since_last_activity = Date.now();
  console.log(dateFormat(time_since_last_activity, "isoDateTime"));
  console.log(`people waiting: ${people_waiting().toString()}`);
  console.log(queue);
  console.log(dj_counts);
  console.log(djs);
  const overlimit_djs = []
  if (people_waiting()) {
    let dj
    for(dj in dj_counts) {
      if (dj_counts[dj].play_count >= 3) {
        overlimit_djs.push(format_name(dj_counts[dj].name));
      }
    }
    if (overlimit_djs.length > 0) {
      bot.speak(`${overlimit_djs.toString()} : Those were some great songs! Take a break and let the next dj up now`);
    }
  }
});

bot.on("rem_dj", function (data) {
  const user = data.user[0]
  time_since_last_activity = Date.now();
  if (queue.length > 0) {
    const name = format_name(queue[0])
    bot.speak(`Hey ${name}, it's your turn on the DJ stand!`);
  }
  if (dj_counts[data.user[0].userid]) {
    delete dj_counts[data.user[0].userid];
  }
  dj_idx = current_dj_list.indexOf(user.userid);
  if (dj_idx >= 0)
    current_dj_list.splice(dj_idx,1);
});

bot.on("snagged", function (_data) {
  time_since_last_activity = Date.now();
  console.log("Song Snagged");  
});

bot.on("update_votes", function (data) {
  time_since_last_activity = Date.now();
  userid = data.room.metadata.votelog[0][0];
  update_last_bop({'userid' : userid});
});


