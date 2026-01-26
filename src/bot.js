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

const currStats = jsonStats2;

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

const { db } = require("../firebase.js");

/* 
client.on("messageCreate", async (message) => { 
    if (message.author.bot) return; 
    
    const userRef = db.collection("users").doc(message.author.id); 
    await userRef.set({ 
    username: message.author.tag, 
    lastMessage: message.content, 
    timestamp: new Date() }, 
    { merge: true }); 
    });
*/

const cron = require('node-cron');

// get marked function

function getCurrentMarkedList(jsonStats) {
    const keys = Object.keys(jsonStats);
    let markedList = [];
    for (let i = 0; i < keys.length; i++) {
        const memberId = keys[i];
        if (jsonStats[memberId].isMarked) {
            markedList.push(memberId); // Return the first active bounty found
        }
    }
    return markedList;
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

            const userRef = db.collection("users").doc(member.id);
            const doc = await userRef.get();

            const senderData = doc.data();

            // formatting output message
            for (let i = 0; i < mentioned_members.length; i++) {
                if (i == mentioned_members.length - 1 && mentioned_members.length > 1)
                    mentioned_members_output += " and"
                mentioned_members_output += " **" + mentioned_members[i] + "**";
                if (i != mentioned_members.length - 1 && mentioned_members.length > 2)
                    mentioned_members_output += ",";
            }

            let isMarkedTransfer = false;
            let stolenMark;
            let stolenMarkPoints;
            // updating new sniping stats
            try {
                const userRef = db.collection("users").doc(member.id);

                if (senderData.isMarked) {
                    await userRef.set({
                        "snipe count": admin.firestore.FieldValue.increment(mentioned_members.length),
                        "overall points": admin.firestore.FieldValue.increment(mentioned_members.length * 3),
                        "accumulation": admin.firestore.FieldValue.increment(mentioned_members.length),
                        "marked snipe count": admin.firestore.FieldValue.increment(mentioned_members.length)
                    },
                        { merge: true });
                } else {
                    await userRef.set({
                        "snipe count": admin.firestore.FieldValue.increment(mentioned_members.length),
                        "overall points": admin.firestore.FieldValue.increment(mentioned_members.length * 2)
                    },
                        { merge: true });
                }

                for (const member of mentioned) {
                    const mentionedRef = db.collection("users").doc(member.id);

                    const mentionedDoc = await mentionedRef.get();
                    const mentionedData = mentionedDoc.data();

                    if (!isMarkedTransfer && mentionedData.isMarked && !senderData.isMarked) {
                        isMarkedTransfer = true;
                        stolenMark = member.id;
                        stolenMarkPoints = mentionedData["accumulation"];
                        await userRef.set({
                            "isMarked": true,
                            "accumulation": 1,
                            "marked count": admin.firestore.FieldValue.increment(1),
                            "marked snipe count": admin.firestore.FieldValue.increment(1),
                            "overall points": admin.firestore.FieldValue.increment(mentionedData["accumulation"])
                        },
                            { merge: true });
                        await mentionedRef.set({
                            "death count": admin.firestore.FieldValue.increment(1),
                            "overall points": admin.firestore.FieldValue.increment(-1),
                            "isMarked": false,
                            "accumulation": 0
                        },
                            { merge: true });
                    } else {
                        await mentionedRef.set({
                            "death count": admin.firestore.FieldValue.increment(1),
                            "overall points": admin.firestore.FieldValue.increment(-1)
                        },
                            { merge: true });
                    }
                };
            }
            catch (error) {
                console.error("Error adding value to firebase:", error);
            }
            // sending snipe message
            let reply_message = `🔫 **${message.member.displayName}** just sniped${mentioned_members_output}! 🔫`;
            // sending marked transfer message
            if (isMarkedTransfer) {
                reply_message += `\n🩸 **${message.member.displayName}** sniped marked **<@${stolenMark}>** for ${stolenMarkPoints} accumulation points! 🩸`;
            }
            message.reply(reply_message);
        }
    }

    // check if message is in bot commands channel
    if (message.channel.name == "bot-commands") {
        // checking for ! command indicator
        if (message.content[0] == "!") {
            try {
                const command = message.content.slice(1);

                // list current marked command
                if (command == "marked") {
                    const snapshot = await db.collection("users").get();
                    const currStats = {};
                    snapshot.forEach(doc => {
                        currStats[doc.id] = doc.data();
                    });
                    const markedList = getCurrentMarkedList(currStats);
                    message.reply(`📍 Marked players are **${currStats[markedList[0]]["name"]}** (${currStats[markedList[0]]["accumulation"]}), **${currStats[markedList[1]]["name"]}** (${currStats[markedList[1]]["accumulation"]}), and **${currStats[markedList[2]]["name"]}** (${currStats[markedList[2]]["accumulation"]})! 📍`);
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
                        const userRef = db.collection("users").doc(snipers[i].id);
                        const doc = await userRef.get();
                        const sniperData = doc.data();

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
                            jsonStats2[snipers[i].id]["isBounty"] = { active: false, alive: false };
                            jsonStats2[snipers[i].id]["overall points"] = 0;
                        }
                        if (!doc.exists) {
                            await userRef.set({
                                "name": snipers[i].displayName,
                                "snipe count": 0,
                                "death count": 0,
                                "overall points": 0,
                                "accumulation": 0,
                                "marked snipe count": 0,
                                "marked count": 0,
                                "isMarked": false,
                            },
                                { merge: true });
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
                    const userRef = db.collection("users").doc(memberid);
                    const doc = await userRef.get();

                    const senderData = doc.data();

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
                    // season 3 stats
                    const snipeCount3 = senderData["snipe count"];
                    const deathCount3 = senderData["death count"];
                    const overallPoints3 = senderData["overall points"];
                    const markedCount = senderData["marked count"];
                    const markedSnipeCount = senderData["marked snipe count"];
                    let denom3 = senderData["death count"];
                    if (denom3 == 0) { denom3 = 1; }
                    message.reply(`## **Player Stats - ${member.displayName}**\n\n
                        **Season 1**\t **${snipeCount}** snipes and **${deathCount}** deaths, **KDR (${snipeCount / denom})**\n
                        **Season 2**\t **${overallPoints}** overall points, **${snipeCount2}** snipes, and **${deathCount2}** deaths, **KDR (${snipeCount2 / denom2})**\n\t\t\t\t\t\t**${bountySnipeCount}** bounty snipes, **${bountySurvivalCount}** bounty survivals\n,
                        **Season 3**\t **${overallPoints3}** overall points, **${snipeCount3}** snipes, and **${deathCount3}** deaths, **KDR (${snipeCount3 / denom3})**\n\t\t\t\t\t\t**${markedCount}** times as marked, **${markedSnipeCount}** snipes as marked`
                    );
                }
                // display other stats
                else if (command.includes("stats") && mentioned.size == 1 && mentioned_members[0].roles.cache.has(sniperRoleID)) {
                    const memberid = mentioned_members[0].user.id;
                    const userRef = db.collection("users").doc(memberid);
                    const doc = await userRef.get();
                    const mentionedData = doc.exists ? doc.data() : null;
                    let snipeCount, deathCount, emojis, denom;
                    let snipeCount2, deathCount2, overallPoints, bountySnipeCount, bountySurvivalCount, denom2;
                    let snipeCount3, deathCount3, overallPoints3, markedCount, markedSnipeCount, denom3;

                    // season 1 stats
                    if (jsonStats[memberid]) {
                        snipeCount = jsonStats[memberid]["snipe count"];
                        deathCount = jsonStats[memberid]["death count"];
                        emojis = jsonStats[memberid]["emojis"];
                        denom = jsonStats[memberid]["death count"];
                        if (denom == 0) { denom = 1; }
                    }
                    else {
                        snipeCount = 0;
                        deathCount = 0;
                        emojis = "";
                        denom = 1;
                    }
                    // season 2 stats
                    if (jsonStats2[memberid]) {
                        snipeCount2 = jsonStats2[memberid]["snipe count"];
                        deathCount2 = jsonStats2[memberid]["death count"];
                        overallPoints = jsonStats2[memberid]["overall points"];
                        bountySnipeCount = jsonStats2[memberid]["bounty snipe count"];
                        bountySurvivalCount = jsonStats2[memberid]["bounty survival count"];
                        denom2 = jsonStats2[memberid]["death count"];
                        if (denom2 == 0) { denom2 = 1; }
                    } else {
                        snipeCount2 = 0;
                        deathCount2 = 0;
                        overallPoints = 0;
                        bountySnipeCount = 0;
                        bountySurvivalCount = 0;
                        denom2 = 1;
                    }
                    // season 3 stats
                    if (doc.exists) {
                        snipeCount3 = mentionedData["snipe count"];
                        deathCount3 = mentionedData["death count"];
                        overallPoints3 = mentionedData["overall points"];
                        markedCount = mentionedData["marked count"];
                        markedSnipeCount = mentionedData["marked snipe count"];
                        denom3 = mentionedData["death count"];
                        if (denom3 == 0) { denom3 = 1; }
                    } else {
                        snipeCount3 = 0;
                        deathCount3 = 0
                        overallPoints3 = 0;
                        markedCount = 0;
                        markedSnipeCount = 0;
                        denom3 = 1;
                    }
                    message.reply(`## **Player Stats - ${mentioned_members[0].displayName}**\n\n**Season 1**\t **${snipeCount}** snipes and **${deathCount}** deaths, **KDR (${snipeCount / denom})**\n**Season 2**\t **${overallPoints}** overall points, **${snipeCount2}** snipes, and **${deathCount2}** deaths, **KDR (${snipeCount2 / denom2})**\n\t\t\t\t\t\t**${bountySnipeCount}** bounty snipes, **${bountySurvivalCount}** bounty survivals\n**Season 3**\t **${overallPoints3}** overall points, **${snipeCount3}** snipes, and **${deathCount3}** deaths, **KDR (${snipeCount3 / denom3})**\n\t\t\t\t\t\t**${markedCount}** times as marked, **${markedSnipeCount}** snipes as marked`
                    );
                }

                // display leaderboard
                if (command == "leaderboard" || command == "kdrleaderboard" || command == "rawleaderboard" || command == "simran") {
                    
                    const snapshot = await db.collection("users").get();

                    const currStats = {};

                    snapshot.forEach(doc => {
                        currStats[doc.id] = doc.data();
                    });
                    
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
                    const keys = Object.keys(currStats);
                    let denom = 1;
                    for (let i = 0; i < keys.length; i++) {
                        const key = keys[i];
                        snipeCounts.push(currStats[key]["snipe count"]);
                        deathCounts.push(currStats[key]["death count"]);
                        overallCounts.push(currStats[key]["overall points"]);
                        denom = currStats[key]["death count"];
                        if (denom == 0) { denom = 1; }
                        kdrCounts.push(currStats[key]["snipe count"] / denom)
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
                            if (currStats[key]["snipe count"] == value && !(Object.values(snipeBoard).includes(currStats[key]["name"]))) {
                                snipeBoard[index] = currStats[key]["name"];
                            }
                        }
                    });
                    deathCounts.forEach(function (value, index) {
                        for (let i = 0; i < keys.length; i++) {
                            const key = keys[i]
                            if (currStats[key]["death count"] == value && !(Object.values(deathBoard).includes(currStats[key]["name"]))) {
                                deathBoard[index] = currStats[key]["name"];
                            }
                        }
                    });
                    overallCounts.forEach(function (value, index) {
                        for (let i = 0; i < keys.length; i++) {
                            const key = keys[i];
                            if (currStats[key]["overall points"] == value && !(Object.values(overallBoard).includes(currStats[key]["name"]))) {
                                overallBoard[index] = currStats[key]["name"];
                            }
                        }
                    });
                    kdrCounts.forEach(function (value, index) {
                        for (let i = 0; i < keys.length; i++) {
                            const key = keys[i]
                            denom = currStats[key]["death count"];
                            if (denom == 0) { denom = 1; }
                            if (currStats[key]["snipe count"] / denom == value && !(Object.values(kdrBoard).includes(currStats[key]["name"]))) {
                                kdrBoard[index] = currStats[key]["name"];
                            }
                        }
                    });
                    let snipeOrder = Object.values(snipeBoard);
                    let deathOrder = Object.values(deathBoard);
                    let overallOrder = Object.values(overallBoard);
                    let kdrOrder = Object.values(kdrBoard);
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
    if (reaction.partial) {
        try { await reaction.fetch(); }
        catch (error) { console.error('❌ Error fetching reaction:', error); return; }
    }

    if (!(reaction.message.author.bot && reaction.message.content.includes("just sniped"))) return;

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);

    if (!(reaction.emoji.name === '🏴' && member.roles.cache.has(snipermodRoleID))) {
        reaction.users.remove(user.id);
        return;
    }

    if (!reaction.message.reference) return;
    const repliedMessage = await reaction.message.channel.messages.fetch(reaction.message.reference.messageId);
    const senderId = repliedMessage.author.id;
    const mentioned = repliedMessage.mentions.members;
    const victimIds = mentioned.map(m => m.id);
    const victimCount = victimIds.length;

    const markedTransferMatch = repliedMessage.content.match(/sniped marked <@(\d+)> for (\d+) accumulation points/);
    const isMarkedTransfer = markedTransferMatch !== null;

    const senderRef = db.collection("users").doc(senderId);
    const senderDoc = await senderRef.get();
    if (!senderDoc.exists) return;
    const senderStats = senderDoc.data();

    let totalPenalty = 0;
    const updates = {};

    if (!senderStats.isMarked) {
        // 1) Regular illegal snipe (sender not marked)
        totalPenalty = 1 + victimCount * 2;

        updates["snipe count"] = admin.firestore.FieldValue.increment(-victimCount);
        updates["overall points"] = admin.firestore.FieldValue.increment(-totalPenalty);
        updates["accumulation"] = 0; // just in case

        for (const victimId of victimIds) {
            const victimRef = db.collection("users").doc(victimId);
            await victimRef.update({
                "death count": admin.firestore.FieldValue.increment(-1),
                "overall points": admin.firestore.FieldValue.increment(1)
            });
        }
    } else if (senderStats.isMarked && !isMarkedTransfer) {
        // 2) Regular marked illegal snipe
        // Only subtract the accumulation gained from this snipe (1 per victim)
        const accumulationPenalty = victimCount;

        totalPenalty = 1 + victimCount * 3 + accumulationPenalty;

        updates["snipe count"] = admin.firestore.FieldValue.increment(-victimCount);
        updates["overall points"] = admin.firestore.FieldValue.increment(-totalPenalty);
        updates["marked snipe count"] = admin.firestore.FieldValue.increment(-1);
        updates["accumulation"] = admin.firestore.FieldValue.increment(-accumulationPenalty);

        for (const victimId of victimIds) {
            const victimRef = db.collection("users").doc(victimId);
            await victimRef.update({
                "death count": admin.firestore.FieldValue.increment(-1),
                "overall points": admin.firestore.FieldValue.increment(1)
            });
        }
    } else if (isMarkedTransfer) {
        // 3) Marked transfer illegal snipe
        const prevMarkedId = markedTransferMatch[1];
        const restoredAccumulation = parseInt(markedTransferMatch[2]);

        if (!senderStats.isMarked) return;

        totalPenalty = 1 + victimCount * 2 + restoredAccumulation;

        updates["snipe count"] = admin.firestore.FieldValue.increment(-victimCount);
        updates["overall points"] = admin.firestore.FieldValue.increment(-totalPenalty);
        updates["marked snipe count"] = admin.firestore.FieldValue.increment(-1);
        updates["marked count"] = admin.firestore.FieldValue.increment(-1);
        updates["accumulation"] = 0;
        updates["isMarked"] = false;

        const prevMarkedRef = db.collection("users").doc(prevMarkedId);
        await prevMarkedRef.update({
            "isMarked": true,
            "accumulation": restoredAccumulation,
            "marked count": admin.firestore.FieldValue.increment(1)
        });

        for (const victimId of victimIds) {
            const victimRef = db.collection("users").doc(victimId);
            await victimRef.update({
                "death count": admin.firestore.FieldValue.increment(-1),
                "overall points": admin.firestore.FieldValue.increment(1)
            });
        }
    }

    await senderRef.update(updates);

    repliedMessage.reply("🚩 Snipe flagged as illegal! All decisions are final! 🚩");
    reaction.message.delete();
});


client.login(TOKEN);

const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));