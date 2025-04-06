const fs = require('fs');

const { Client, IntentsBitField } = require('discord.js');
const sniperRoleID = '1358177429297828012';

// loading stats and token data from json files
filePath = 'src/stats.json'
const statsFile = fs.readFileSync(filePath, 'utf8');
const tokenFile = fs.readFileSync('src/token.json', 'utf8');
const jsonStats = JSON.parse(statsFile);
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

     if (message.channel.name != "sniped") {
          return;
    }

    // checking for ! command indicator
    if(message.content[0] == "!") {
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
                if(!(snipers[i].id in jsonStats)) {
                    jsonStats[snipers[i].id] = {};
                    jsonStats[snipers[i].id]["name"] = snipers[i].displayName;
                    jsonStats[snipers[i].id]["snipe count"] = 0;
                    jsonStats[snipers[i].id]["death count"] = 0;
                    jsonStats[snipers[i].id]["emojis"] = "";
                }
            }
            const updatedJsonStats = JSON.stringify(jsonStats, null, 2);
            fs.writeFileSync(filePath, updatedJsonStats, 'utf8');
            message.reply("**Snipers updated**")
        }

        mentioned.forEach(member => {
            mentioned_members.push(member);
          });
        // display own stats
        if(command == "stats") {
            const memberid = member.user.id;
            const snipeCount = jsonStats[memberid]["snipe count"];
            const deathCount = jsonStats[memberid]["death count"];
            const emojis = jsonStats[memberid]["emojis"];
            message.reply(`## **Player Stats**\n\n**${member.displayName}** has **${snipeCount} snipes** and **${deathCount} deaths**\n\n${emojis}`);
        }
        // display other stats
        else if (command.includes("stats") && mentioned.size == 1 && mentioned_members[0].roles.cache.has(sniperRoleID)) {
            console.log("hi")
            const memberid = mentioned_members[0].user.id;
            const snipeCount = jsonStats[memberid]["snipe count"];
            const deathCount = jsonStats[memberid]["death count"];
            const emojis = jsonStats[memberid]["emojis"];
            message.reply(`## **Player Stats**\n\n**${mentioned_members[0].displayName}** has **${snipeCount} snipes** and **${deathCount} deaths**\n\n${emojis}`);
        }

        // display leaderboard
        if(command == "leaderboard") {
            const snipeCounts = [];
            const deathCounts = [];
            const snipeBoard = {};
            const deathBoard = {};
            const snipeBoardData = [];
            const deathBoardData = [];
            const keys = Object.keys(jsonStats);
            console.log(keys.length);
            for(let i = 0; i < keys.length; i++) {
                const key = keys[i];
                snipeCounts.push(jsonStats[key]["snipe count"]);
                deathCounts.push(jsonStats[key]["death count"]);
            }
            snipeCounts.sort();
            snipeCounts.reverse();
            deathCounts.sort();
            deathCounts.reverse();
            snipeCounts.forEach(function(value, index) {
                for(let i = 0; i < keys.length; i++) {
                    const key = keys[i];
                    if(jsonStats[key]["snipe count"] == value) {
                        snipeBoard[index] = jsonStats[key]["name"];
                    }
                }
            });
            deathCounts.forEach(function(value, index) {
                for(let i = 0; i < keys.length; i++) {
                    const key = keys[i]
                    if(jsonStats[key]["death count"] == value) {
                        deathBoard[index] = jsonStats[key]["name"];
                    }
                }
            });
            console.log(snipeBoard);
            snipeOrder = Object.values(snipeBoard);
            deathOrder = Object.values(deathBoard);
            for(let i = 0; i < keys.length; i++) {
                snipeBoardData.push({name: snipeOrder[i], points: snipeCounts[i]});
            }
            for(let i = 0; i < keys.length; i++) {
                deathBoardData.push({name: deathOrder[i], points: deathCounts[i]});
            }
            const snipeLeaderboardData = snipeBoardData
                .map((entry, index) => `${index + 1}. **${entry.name}** – ${entry.points} pts`)
                .join('\n');
            const deathLeaderboardData = deathBoardData
                .map((entry, index) => `${index + 1}. **${entry.name}** – ${entry.points} pts`)
                .join('\n');
            message.reply(`## 🏆 **Snipe Leaderboard** 🏆\n\n${snipeLeaderboardData}\n\n## 💀 **Death Leaderboard** 💀\n\n${deathLeaderboardData}`);
        }
    }
    
    let validSnipe = true;
    let mentioned_members_output = "";

    // checking if sender has sniper role and message contains mentions
    if(!member.roles.cache.has(sniperRoleID) || !(mentioned.size > 0)) {
        validSnipe = false;
    }

    // checking if message has an image
    if (message.attachments.size == 0) {
        validSnipe = false;
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

    // sending error message if message has image but no mentions
    if(member.roles.cache.has(sniperRoleID) && message.attachments.size > 0 && mentioned.size == 0) {
        message.reply("You must mention the person you're sniping in the same message!");
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
            jsonStats[member.id]["snipe count"] += 1;
            jsonStats[member.id]["emojis"] += "🏆";
            mentioned.forEach(member => {
                jsonStats[member.id]["death count"] += 1;
                jsonStats[member.id]["emojis"] += "💀";
              });
            const updatedJsonStats = JSON.stringify(jsonStats, null, 2);
            fs.writeFileSync(filePath, updatedJsonStats, 'utf8');
        }
        catch (error) {
            console.error("Error adding value to stats.json:", error);
        }
    }
})

client.login(TOKEN);