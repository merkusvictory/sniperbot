const fs = require('fs');
const express = require("express");

const { Client, IntentsBitField, Partials } = require('discord.js');
const sniperRoleID = '1316110453935575101';
const snipermodRoleID = '1349181053973041185';
const snipedChannelID = '1307188865404112980';

// loading stats and token data from json files
const filePath = 'src/stats.json'
const filePath2 = 'src/stats2.json'
const statsFile = fs.readFileSync(filePath, 'utf8');
const stats2File = fs.readFileSync(filePath2, 'utf8')
const tokenFile = fs.readFileSync('token.json', 'utf8');
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

const cron = require('node-cron');

client.on('ready', (c) => {
    console.log(`${c.user.username} is set`);

    cron.schedule('0 0 * * *', async () => {
        // removing bounty roles

        const channel = await client.channels.fetch(snipedChannelID);

        const keys = Object.keys(jsonStats2)
        for (let i = 0; i < keys.length; i++) {
            const memberId = keys[i];
            if (jsonStats2[memberId]["isBounty"].active && jsonStats2[memberId]["isBounty"].alive) {
                // if bounty survived the day
                channel.send(`😎 Bounty **${jsonStats2[memberId]["name"]}** survived the day! 😎`);
                jsonStats2[memberId]["overall points"] += 11;
                jsonStats2[memberId]["bounty survival count"] += 1;
                const updatedJsonStats = JSON.stringify(jsonStats2, null, 2);
                fs.writeFileSync(filePath2, updatedJsonStats, 'utf8');
            }
            jsonStats2[memberId]["isBounty"] = { active: false, alive: false};
        }
        const updatedJsonStats = JSON.stringify(jsonStats2, null, 2);
        console.log(updatedJsonStats);
        fs.writeFileSync(filePath2, updatedJsonStats, 'utf8');
    }, {
        timezone: "America/New_York"
    });

    cron.schedule('30 8 * * 1-5', async () => {
        const channel = await client.channels.fetch(snipedChannelID);
        const guild = channel.guild;

        const sniperRole = guild.roles.cache.get(sniperRoleID);

        // Get members who have the sniper role
        const keys = sniperRole.members.map(member => member.id);

        // setting random bounty
        const bountyId = keys[Math.floor(Math.random() * keys.length)];
        jsonStats2[bountyId]["isBounty"] = { active: true, alive: true};
        const updatedJsonStats = JSON.stringify(jsonStats2, null, 2);
        fs.writeFileSync(filePath2, updatedJsonStats, 'utf8');
        channel.send(`💰 Today's bounty is **${jsonStats2[bountyId]["name"]} <@${bountyId}>** 💰`);
    }, {
        timezone: "America/New_York"
    });
});

// get bounty function
function getCurrentBountyId(jsonStats) {
    const keys = Object.keys(jsonStats);
    for (let i = 0; i < keys.length; i++) {
        const memberId = keys[i];
        if (jsonStats[memberId]["isBounty"].active && jsonStats[memberId]["isBounty"].alive) {
            return memberId; // Return the first active bounty found
        }
    }
    return null;
}

client.on('messageCreate', async (message) => {

    const member = message.member;
    const sender = message.member;
    const guild = message.guild;
    const sniper = guild.roles.cache.get(sniperRoleID);
    const mentioned = message.mentions.members;
    const mentioned_members = [];

    // checks if message is in snipe channel
    if (message.channel.name == "📸sniped") {

        // adds flag reaction to snipe messages
        if (message.author.bot && message.content.includes("just sniped")) {
            message.react("🏴");
        }

        let validSnipe = true;
        let mentioned_members_output = "";

        // checking if sender has sniper role and message contains mentions
        if (!member.roles.cache.has(sniperRoleID) || !(mentioned.size > 0)) {
            validSnipe = false;
            // sending error message if message has image but no mentions
            if (member.roles.cache.has(sniperRoleID) && message.attachments.size > 0) {
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
                if (!member.roles.cache.has(sniperRoleID)) {
                    message.reply("Invalid snipe, no sniping non-snipers!");
                    validSnipe = false;
                }
            });
        }

        if (validSnipe) {

            const bountyId = getCurrentBountyId(jsonStats2);
            let isBountySnipe = false;

            // checking if bounty was sniped
            if (bountyId) {
                mentioned.forEach(member => {
                    if (member.id == bountyId && jsonStats2[bountyId]["isBounty"].active && jsonStats2[bountyId]["isBounty"].alive) {
                        isBountySnipe = true;
                        jsonStats2[bountyId]["isBounty"] = { active: true, alive: false, killerId: sender.id };
                    }
                });
            }

            // formatting output message
            for (let i = 0; i < mentioned_members.length; i++) {
                if (i == mentioned_members.length - 1 && mentioned_members.length > 1)
                    mentioned_members_output += " and"
                mentioned_members_output += " **" + mentioned_members[i] + "**";
                if (i != mentioned_members.length - 1 && mentioned_members.length > 2)
                    mentioned_members_output += ",";
            }

            // sending snipe message
            let reply_message = `🔫 **${message.member.displayName}** just sniped${mentioned_members_output}! 🔫`;
            // sending bounty found message
            if (isBountySnipe) {
                reply_message += `\n🤑 **${message.member.displayName}** sniped bounty **${jsonStats2[bountyId]["name"]}**! 🤑`;
            }
            message.reply(reply_message);

            // updating new sniping stats
            try {
                jsonStats2[member.id]["snipe count"] += mentioned_members.length;
                jsonStats2[member.id]["emojis"] += "🏆".repeat(mentioned_members.length);
                jsonStats2[member.id]["overall points"] += mentioned_members.length * 2;
                if (isBountySnipe) {
                    jsonStats2[member.id]["bounty snipe count"] += 1;
                    jsonStats2[member.id]["overall points"] += 5;
                }
                mentioned.forEach(member => {
                    jsonStats2[member.id]["death count"] += 1;
                    jsonStats2[member.id]["overall points"] -= 1;
                });
                const updatedJsonStats = JSON.stringify(jsonStats2, null, 2);
                fs.writeFileSync(filePath2, updatedJsonStats, 'utf8');
            }
            catch (error) {
                console.error("Error adding value to stats.json:", error);
            }
        }
    }

    // check if message is in bot commands channel
    if (message.channel.name == "bot-commands") {
        // checking for ! command indicator
        if (message.content[0] == "!") {
            try {
                const command = message.content.slice(1);

                // bounty command
                if (command == "bounty") {
                    const bountyId = getCurrentBountyId(jsonStats2);
                    if (bountyId) message.reply(`💰 Current bounty is ${jsonStats2[bountyId]["name"]}! 💰`)
                    else message.reply(`😔 There is no active bounty at the time 😔`)
                }

                // list snipers command
                if (command == "listsnipers") {
                    await guild.members.fetch();
                    const snipers = sniper.members.map(member => member.user.displayName);
                    message.reply(`## **Members with Sniper Role**:\n\n${snipers.join('\n')}`);
                }
                // update snipers command
                if (command == "updatesnipers") {
                    await guild.members.fetch();
                    const snipers = sniper.members.map(member => member.user);
                    for (let i = 0; i < snipers.length; i++) {
                        if (!(snipers[i].id in jsonStats)) {
                            jsonStats[snipers[i].id] = {};
                            jsonStats[snipers[i].id]["name"] = snipers[i].displayName;
                            jsonStats[snipers[i].id]["snipe count"] = 0;
                            jsonStats[snipers[i].id]["death count"] = 0;
                            jsonStats[snipers[i].id]["emojis"] = "";
                        }
                        if (!(snipers[i].id in jsonStats2)) {
                            jsonStats2[snipers[i].id] = {};
                            jsonStats2[snipers[i].id]["name"] = snipers[i].displayName;
                            jsonStats2[snipers[i].id]["snipe count"] = 0;
                            jsonStats2[snipers[i].id]["death count"] = 0;
                            jsonStats2[snipers[i].id]["bounty snipe count"] = 0;
                            jsonStats2[snipers[i].id]["bounty survival count"] = 0;
                            jsonStats2[snipers[i].id]["isBounty"] = { active: false, alive: false};
                            jsonStats2[snipers[i].id]["overall points"] = 0;
                        }
                    }
                    const updatedJsonStats = JSON.stringify(jsonStats, null, 2);
                    const updatedJsonStats2 = JSON.stringify(jsonStats2, null, 2);
                    fs.writeFileSync(filePath, updatedJsonStats, 'utf8');
                    fs.writeFileSync(filePath2, updatedJsonStats2, 'utf8');
                    message.reply("**Snipers updated**")
                }

                mentioned.forEach(member => {
                    mentioned_members.push(member);
                });
                // display own stats
                if (command == "stats" && member.roles.cache.has(sniperRoleID)) {
                    const memberid = member.user.id;
                    // season 1 stats
                    const snipeCount = jsonStats[memberid]["snipe count"];
                    const deathCount = jsonStats[memberid]["death count"];
                    const emojis = jsonStats[memberid]["emojis"];
                    let denom = jsonStats[memberid]["death count"];
                    if (denom == 0) { denom = 1; }
                    // season 2 stats
                    const snipeCount2 = jsonStats2[memberid]["snipe count"];
                    const deathCount2 = jsonStats2[memberid]["death count"];
                    const overallPoints = jsonStats2[memberid]["overall points"];
                    const bountySnipeCount = jsonStats2[memberid]["bounty snipe count"];
                    const bountySurvivalCount = jsonStats2[memberid]["bounty survival count"];
                    let denom2 = jsonStats2[memberid]["death count"];
                    if (denom2 == 0) { denom2 = 1; }
                    message.reply(`## **Player Stats - ${member.displayName}**\n\n**Season 1**\t **${snipeCount}** snipes and **${deathCount}** deaths, **KDR (${snipeCount / denom})**\n**Season 2**\t **${overallPoints}** overall points, **${snipeCount2}** snipes, and **${deathCount2}** deaths, **KDR (${snipeCount2 / denom2})**\n\t\t\t\t\t\t**${bountySnipeCount}** bounty snipes, **${bountySurvivalCount}** bounty survivals`);
                }
                // display other stats
                else if (command.includes("stats") && mentioned.size == 1 && mentioned_members[0].roles.cache.has(sniperRoleID)) {
                    const memberid = mentioned_members[0].user.id;
                    // season 1 stats
                    const snipeCount = jsonStats[memberid]["snipe count"];
                    const deathCount = jsonStats[memberid]["death count"];
                    const emojis = jsonStats[memberid]["emojis"];
                    let denom = jsonStats[memberid]["death count"];
                    if (denom == 0) { denom = 1; }
                    // season 2 stats
                    const snipeCount2 = jsonStats2[memberid]["snipe count"];
                    const deathCount2 = jsonStats2[memberid]["death count"];
                    const overallPoints = jsonStats2[memberid]["overall points"];
                    const bountySnipeCount = jsonStats2[memberid]["bounty snipe count"];
                    const bountySurvivalCount = jsonStats2[memberid]["bounty survival count"];
                    let denom2 = jsonStats2[memberid]["death count"];
                    if (denom2 == 0) { denom2 = 1; }
                    message.reply(`## **Player Stats - ${mentioned_members[0].displayName}**\n\n**Season 1**\t **${snipeCount}** snipes and **${deathCount}** deaths, **KDR (${snipeCount / denom})**\n**Season 2**\t **${overallPoints}** overall points, **${snipeCount2}** snipes, and **${deathCount2}** deaths, **KDR (${snipeCount2 / denom2})**\n\t\t\t\t\t\t**${bountySnipeCount}** bounty snipes, **${bountySurvivalCount}** bounty survivals`);
                }

                // display leaderboard
                if (command == "leaderboard" || command == "kdrleaderboard" || command == "rawleaderboard" || command == "simran") {
                    const snipeCounts = [];
                    const deathCounts = [];
                    const kdrCounts = [];
                    const overallCounts = []
                    const snipeBoard = {};
                    const deathBoard = {};
                    const kdrBoard = {};
                    const overallBoard = {}
                    const snipeBoardData = [];
                    const deathBoardData = [];
                    const kdrBoardData = [];
                    const overallBoardData = [];
                    const keys = Object.keys(jsonStats2);
                    let denom = 1;
                    for (let i = 0; i < keys.length; i++) {
                        const key = keys[i];
                        snipeCounts.push(jsonStats2[key]["snipe count"]);
                        deathCounts.push(jsonStats2[key]["death count"]);
                        overallCounts.push(jsonStats2[key]["overall points"]);
                        denom = jsonStats2[key]["death count"];
                        if (denom == 0) { denom = 1; }
                        kdrCounts.push(jsonStats2[key]["snipe count"] / denom)
                    }
                    snipeCounts.sort(function (a, b) {
                        return b - a;
                    });
                    deathCounts.sort(function (a, b) {
                        return b - a;
                    });
                    overallCounts.sort(function (a, b) {
                        return b - a;
                    })
                    kdrCounts.sort(function (a, b) {
                        return b - a;
                    });
                    snipeCounts.forEach(function (value, index) {
                        for (let i = 0; i < keys.length; i++) {
                            const key = keys[i];
                            if (jsonStats2[key]["snipe count"] == value && !(Object.values(snipeBoard).includes(jsonStats2[key]["name"]))) {
                                snipeBoard[index] = jsonStats2[key]["name"];
                            }
                        }
                    });
                    deathCounts.forEach(function (value, index) {
                        for (let i = 0; i < keys.length; i++) {
                            const key = keys[i]
                            if (jsonStats2[key]["death count"] == value && !(Object.values(deathBoard).includes(jsonStats2[key]["name"]))) {
                                deathBoard[index] = jsonStats2[key]["name"];
                            }
                        }
                    });
                    overallCounts.forEach(function (value, index) {
                        for (let i = 0; i < keys.length; i++) {
                            const key = keys[i];
                            if (jsonStats2[key]["overall points"] == value && !(Object.values(overallBoard).includes(jsonStats2[key]["name"]))) {
                                overallBoard[index] = jsonStats2[key]["name"];
                            }
                        }
                    });
                    kdrCounts.forEach(function (value, index) {
                        for (let i = 0; i < keys.length; i++) {
                            const key = keys[i]
                            denom = jsonStats2[key]["death count"];
                            if (denom == 0) { denom = 1; }
                            if (jsonStats2[key]["snipe count"] / denom == value && !(Object.values(kdrBoard).includes(jsonStats2[key]["name"]))) {
                                kdrBoard[index] = jsonStats2[key]["name"];
                            }
                        }
                    });
                    snipeOrder = Object.values(snipeBoard);
                    deathOrder = Object.values(deathBoard);
                    overallOrder = Object.values(overallBoard);
                    kdrOrder = Object.values(kdrBoard);
                    for (let i = 0; i < keys.length; i++) {
                        snipeBoardData.push({ name: snipeOrder[i], points: snipeCounts[i] });
                    }
                    for (let i = 0; i < keys.length; i++) {
                        deathBoardData.push({ name: deathOrder[i], points: deathCounts[i] });
                    }
                    for (let i = 0; i < keys.length; i++) {
                        overallBoardData.push({ name: overallOrder[i], points: overallCounts[i] });
                    }
                    for (let i = 0; i < keys.length; i++) {
                        kdrBoardData.push({ name: kdrOrder[i], points: kdrCounts[i] });
                    }
                    const snipeLeaderboardData = snipeBoardData
                        .map((entry, index) => `${index + 1}. **${entry.name}** – ${entry.points} pts`)
                        .join('\n');
                    const deathLeaderboardData = deathBoardData
                        .map((entry, index) => `${index + 1}. **${entry.name}** – ${entry.points} pts`)
                        .join('\n');
                    const overallLeaderboardData = overallBoardData
                        .map((entry, index) => `${index + 1}. **${entry.name}** – ${entry.points} pts`)
                        .join('\n');
                    const kdrLeaderboardData = kdrBoardData
                        .map((entry, index) => `${index + 1}. **${entry.name}** – ${entry.points}`)
                        .join('\n');
                    if (command == "leaderboard" || command == "simran")
                        message.reply(`## 🏆 **Overall Leaderboard** 🏆\n\n${overallLeaderboardData}`)
                    if (command == "rawleaderboard")
                        message.reply(`## 🔫 **Snipe Leaderboard** 🔫\n\n${snipeLeaderboardData}\n\n## 💀 **Death Leaderboard** 💀\n\n${deathLeaderboardData}`);
                    if (command == "kdrleaderboard")
                        message.reply(`## 🔥 **KDR Leaderboard** 🔥\n\n${kdrLeaderboardData}`);
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
    if (!(reaction.message.author.bot && reaction.message.content.includes("just sniped")))
        return;

    const guild = reaction.message.guild;

    // Fetch the member from the guild
    const member = await guild.members.fetch(user.id);

    // checking if user has the high snipress role and used correct reaction
    if (!(reaction.emoji.name === '🏴') || !(member.roles.cache.has(snipermodRoleID))) {
        reaction.users.remove(user.id);
        return;
    }

    // getting people mentioned as well as sender of message
    const repliedMessage = await reaction.message.channel.messages.fetch(reaction.message.reference.messageId);
    const sender = repliedMessage.author;
    const mentioned = repliedMessage.mentions.members;
    const mentioned_members = [];
    mentioned.forEach(member => {
        mentioned_members.push(member.displayName);
        if (!member.roles.cache.has(sniperRoleID)) {
            repliedMessage.reply("Invalid snipe, no sniping non-snipers!");
            validSnipe = false;
        }
    });

    // fixing stats
    let isBountySnipe = false;
    const bountyId = getCurrentBountyId(jsonStats2);

    mentioned.forEach(member => {
        if (bountyId) {
            if (member.id == bountyId && jsonStats2[bountyId]["isBounty"].killerId == sender.id && !jsonStats2[bountyId]["isBounty"].alive) {
                isBountySnipe = true;
                jsonStats2[bountyId]["isBounty"].alive = true;
                delete jsonStats2[bountyId]["isBounty"].killerId
                jsonStats2[sender.id]["overall points"] -= 8;
                jsonStats2[sender.id]["bounty snipe count"] -= 1;
            }
        }
        jsonStats2[member.id]["death count"] -= 1;
        jsonStats2[member.id]["emojis"] += "😇";
        jsonStats2[member.id]["overall points"] += 1;
    });
    jsonStats2[sender.id]["snipe count"] -= mentioned_members.length;
    jsonStats2[sender.id]["emojis"] += "🏴".repeat(mentioned_members.length);
    jsonStats2[sender.id]["overall points"] -= (mentioned_members.length * 2) + 1;
    const updatedJsonStats = JSON.stringify(jsonStats2, null, 2);
    fs.writeFileSync(filePath2, updatedJsonStats, 'utf8');

    // replying with illegal notification
    repliedMessage.reply("🚩 Snipe flagged as illegal! All decisions are final! 🚩");
    reaction.message.delete();
});

client.login(TOKEN);

const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));