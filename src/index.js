const fs = require('fs');

const { Client, IntentsBitField, Partials } = require('discord.js');
const sniperRoleID = '1358177429297828012';
const snipermodRoleID = '1358940406854713376';

// loading stats and token data from json files
const statsFile = fs.readFileSync('src/stats.json', 'utf8');
const stats2File = fs.readFileSync('src/stats2.json', 'utf8')
const tokenFile = fs.readFileSync('src/token.json', 'utf8');
const jsonStats = JSON.parse(statsFile);
const jsonStats2 = JSON.parse(stats2File)
const jsonToken = JSON.parse(tokenFile);
const TOKEN = jsonToken["token"];
const CLIENTID = jsonToken["clientId"];

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMessageReactions,
        IntentsBitField.Flags.GuildPresences
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
});


client.on('ready', (c) => {
    console.log(`${c.user.username} is set`);
});

client.on('messageCreate', (message) => {

    const member = message.member;
    const guild = message.guild;
    const sniper = guild.roles.cache.get(sniperRoleID);
    const mentioned = message.mentions.members;
    const mentioned_members = [];

    // checks if message is in snipe channel
    if (message.channel.name == "sniped") {

        // adds flag reaction to snipe messages
        if (message.author.bot && message.content.includes("just sniped")) {
            message.react("🏴");
        }
        
        let validSnipe = true;
        let mentioned_members_output = "";

        // checking if sender has sniper role and message contains mentions
        if(!member.roles.cache.has(sniperRoleID) || !(mentioned.size > 0)) {
            validSnipe = false;
            // sending error message if message has image but no mentions
            if(member.roles.cache.has(sniperRoleID) && message.attachments.size > 0) {
                message.reply("You must mention the person you're sniping in the same message!");
            }
        }

        // checking if message has an image
        if (message.attachments.size == 0) {
            validSnipe = false;
            return;
        }
        else {
            // storing mentioned users in an array and checking if all are snipers
            mentioned.forEach(member => {
                mentioned_members.push(member.displayName);
                if(!member.roles.cache.has(sniperRoleID)) {
                    message.reply("Invalid snipe, no sniping non-snipers!");
                    validSnipe = false;
                }
            });
        }
        
        if(validSnipe) {
            // formatting output message
            for(let i = 0; i < mentioned_members.length; i++) {
                if(i == mentioned_members.length - 1 && mentioned_members.length > 1)
                    mentioned_members_output += " and"
                mentioned_members_output += " **" + mentioned_members[i] + "**";
                if(i != mentioned_members.length - 1 && mentioned_members.length > 2)
                    mentioned_members_output += ",";
            }

            // sending snipe message
            message.reply(`🔫  **${message.member.displayName}** just sniped${mentioned_members_output}!  🔫`);

            // updating new sniping stats
            try {
                jsonStats2[member.id]["snipe count"] += mentioned_members.length;
                jsonStats2[member.id]["emojis"] += "🏆".repeat(mentioned_members.length);
                mentioned.forEach(member => {
                    jsonStats2[member.id]["death count"] += 1;
                    jsonStats2[member.id]["emojis"] += "💀";
                });
                const updatedJsonStats = JSON.stringify(jsonStats2, null, 2);
                fs.writeFileSync(filePath, updatedJsonStats, 'utf8');
            }
            catch (error) {
                console.error("Error adding value to stats.json:", error);
            }
        }
    }

    // check if message is in bot commands channel
    if(message.channel.name == "bot-commands") {
        // checking for ! command indicator
        if(message.content[0] == "!") {
            try {
                const command = message.content.slice(1);

                // list snipers command
                if(command == "listsnipers") {
                    guild.members.fetch();
                    const snipers = sniper.members.map(member => member.user.displayName);
                    message.reply(`## **Members with Sniper Role**:\n\n${snipers.join('\n')}`);
                }
                // update snipers command
                if(command == "updatesnipers") {
                    guild.members.fetch();
                    const snipers = sniper.members.map(member => member.user);
                    for(let i = 0; i < snipers.length; i++) {
                        if(!(snipers[i].id in jsonStats2)) {
                            jsonStats2[snipers[i].id] = {};
                            jsonStats2[snipers[i].id]["name"] = snipers[i].displayName;
                            jsonStats2[snipers[i].id]["snipe count"] = 0;
                            jsonStats2[snipers[i].id]["death count"] = 0;
                            jsonStats2[snipers[i].id]["emojis"] = "";
                        }
                    }
                    const updatedJsonStats = JSON.stringify(jsonStats2, null, 2);
                    fs.writeFileSync(filePath, updatedJsonStats2, 'utf8');
                    message.reply("**Snipers updated**")
                }

                mentioned.forEach(member => {
                    mentioned_members.push(member);
                });
                // display own stats
                if(command == "stats" && member.roles.cache.has(sniperRoleID)) {
                    const memberid = member.user.id;
                    const snipeCount = jsonStats2[memberid]["snipe count"];
                    const deathCount = jsonStats2[memberid]["death count"];
                    const emojis = jsonStats2[memberid]["emojis"];
                    let denom = jsonStats2[memberid]["death count"];
                    if(denom == 0) {denom = 1;}
                    message.reply(`## **Player Stats**\n\n**${member.displayName}** has **${snipeCount} snipes** and **${deathCount} deaths**, **KDR (${snipeCount/denom})**\n\n${emojis}`);
                }
                // display other stats
                else if (command.includes("stats") && mentioned.size == 1 && mentioned_members[0].roles.cache.has(sniperRoleID)) {
                    const memberid = mentioned_members[0].user.id;
                    const snipeCount = jsonStats2[memberid]["snipe count"];
                    const deathCount = jsonStats2[memberid]["death count"];
                    const emojis = jsonStats2[memberid]["emojis"];
                    let denom = jsonStats2[memberid]["death count"];
                    if(denom == 0) {denom = 1;}
                    message.reply(`## **Player Stats**\n\n**${mentioned_members[0].displayName}** has **${snipeCount} snipes** and **${deathCount} deaths**, **KDR (${snipeCount/denom})**\n\n${emojis}`);
                }

                // display leaderboard
                if(command == "leaderboard" || command == "kdrleaderboard") {
                    const snipeCounts = [];
                    const deathCounts = [];
                    const kdrCounts = [];
                    const snipeBoard = {};
                    const deathBoard = {};
                    const kdrBoard = {};
                    const snipeBoardData = [];
                    const deathBoardData = [];
                    const kdrBoardData = [];
                    const keys = Object.keys(jsonStats2);
                    let denom = 1;
                    for(let i = 0; i < keys.length; i++) {
                        const key = keys[i];
                        snipeCounts.push(jsonStats2[key]["snipe count"]);
                        deathCounts.push(jsonStats2[key]["death count"]);
                        denom = jsonStats2[key]["death count"];
                        if(denom == 0) {denom = 1;}
                        kdrCounts.push(jsonStats2[key]["snipe count"]/denom)
                    }
                    snipeCounts.sort(function(a, b) {
                        return b - a;
                      });
                    deathCounts.sort(function(a, b) {
                        return b - a;
                      });
                    kdrCounts.sort(function(a, b) {
                        return b - a;
                      });
                    snipeCounts.forEach(function(value, index) {
                        for(let i = 0; i < keys.length; i++) {
                            const key = keys[i];
                            if(jsonStats2[key]["snipe count"] == value && !(Object.values(snipeBoard).includes(jsonStats[key]["name"]))) {
                                snipeBoard[index] = jsonStats2[key]["name"];
                            }
                        }
                    });
                    deathCounts.forEach(function(value, index) {
                        for(let i = 0; i < keys.length; i++) {
                            const key = keys[i]
                            if(jsonStats2[key]["death count"] == value && !(Object.values(deathBoard).includes(jsonStats[key]["name"]))) {
                                deathBoard[index] = jsonStats2[key]["name"];
                            }
                        }
                    });
                    kdrCounts.forEach(function(value, index) {
                        for(let i = 0; i < keys.length; i++) {
                            const key = keys[i]
                            denom = jsonStats2[key]["death count"];
                            if(denom == 0) {denom = 1;}
                            if(jsonStats2[key]["snipe count"]/denom == value && !(Object.values(kdrBoard).includes(jsonStats[key]["name"]))) {
                                kdrBoard[index] = jsonStats2[key]["name"];
                            }
                        }
                    });
                    snipeOrder = Object.values(snipeBoard);
                    deathOrder = Object.values(deathBoard);
                    kdrOrder = Object.values(kdrBoard);
                    for(let i = 0; i < keys.length; i++) {
                        snipeBoardData.push({name: snipeOrder[i], points: snipeCounts[i]});
                    }
                    for(let i = 0; i < keys.length; i++) {
                        deathBoardData.push({name: deathOrder[i], points: deathCounts[i]});
                    }
                    for(let i = 0; i < keys.length; i++) {
                        kdrBoardData.push({name: kdrOrder[i], points: kdrCounts[i]});
                    }
                    const snipeLeaderboardData = snipeBoardData
                        .map((entry, index) => `${index + 1}. **${entry.name}** – ${entry.points} pts`)
                        .join('\n');
                    const deathLeaderboardData = deathBoardData
                        .map((entry, index) => `${index + 1}. **${entry.name}** – ${entry.points} pts`)
                        .join('\n');
                    const kdrLeaderboardData = kdrBoardData
                        .map((entry, index) => `${index + 1}. **${entry.name}** – ${entry.points}`)
                        .join('\n');
                    if(command == "leaderboard")
                        message.reply(`## 🏆 **Snipe Leaderboard** 🏆\n\n${snipeLeaderboardData}\n\n## 💀 **Death Leaderboard** 💀\n\n${deathLeaderboardData}`);
                    if(command == "kdrleaderboard")
                        message.reply(`## 🔥  **KDR Leaderboard** 🔥\n\n${kdrLeaderboardData}`);
                }
            } catch (error) {
                console.error("Error executing commands:", error);
            }
            return;
        }
    }
})

client.on('messageReactionAdd', async (reaction, user) => {
    // Ensure it's cached
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error('❌ Error fetching reaction:', error);
        return;
      }
    }

    // checking if the message reacted to is correct
    if(!(reaction.message.author.bot && reaction.message.content.includes("just sniped")))
        return;

    const guild = reaction.message.guild;

    // Fetch the member from the guild
    const member = await guild.members.fetch(user.id);

    // checking if user has the high snipress role and used correct reaction
    if(!(reaction.emoji.name === '🏴')  || !(member.roles.cache.has(snipermodRoleID))) {
        reaction.users.remove(user.id);
        return;
    }

    // getting people mentioned as well as sender of message
    const repliedMessage = await reaction.message.channel.messages.fetch(reaction.message.reference.messageId);
    console.log(repliedMessage.mentions);
    const sender = repliedMessage.author;
    const mentioned = repliedMessage.mentions.members;
    const mentioned_members = [];
    mentioned.forEach(member => {
        mentioned_members.push(member.displayName);
        if(!member.roles.cache.has(sniperRoleID)) {
            message.reply("Invalid snipe, no sniping non-snipers!");
            validSnipe = false;
        }
    });

    // fixing stats
    mentioned.forEach(member => {
        jsonStats2[member.id]["death count"] -= 1;
        jsonStats2[member.id]["emojis"] += "😇";
      });
    jsonStats2[sender.id]["snipe count"] -= mentioned_members.length;
    jsonStats2[sender.id]["emojis"] += "🏴".repeat(mentioned_members.length);
    const updatedJsonStats = JSON.stringify(jsonStats2, null, 2);
    fs.writeFileSync(filePath, updatedJsonStats, 'utf8');

    // replying with illegal notification
    repliedMessage.reply("🚩 Snipe flagged as illegal! All decisions are final! 🚩");
    reaction.message.delete();
});

client.login(TOKEN);