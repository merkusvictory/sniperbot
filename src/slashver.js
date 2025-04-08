const { Client, IntentsBitField, Partials, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

const sniperRoleID = '1316110453935575101';
const snipermodRoleID = '1349181053973041185';
const filePath = 'src/stats.json';
const tokenFile = fs.readFileSync('src/token.json', 'utf8');
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

client.once('ready', async () => {
    console.log(`${client.user.username} is online`);

    const commands = [
        new SlashCommandBuilder()
            .setName('listsnipers')
            .setDescription('Lists all members with the Sniper role.'),
        new SlashCommandBuilder()
            .setName('updatesnipers')
            .setDescription('Updates the sniper statistics.'),
        new SlashCommandBuilder()
            .setName('stats')
            .setDescription('Displays sniper statistics.')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to display stats for')
                    .setRequired(false)),
        new SlashCommandBuilder()
            .setName('leaderboard')
            .setDescription('Displays the sniper leaderboard.')
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        await rest.put(
            Routes.applicationCommands(CLIENTID),
            { body: commands },
        );
        console.log('Successfully registered application commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options, guild, member } = interaction;

    if (commandName === 'listsnipers') {
        const sniperRole = guild.roles.cache.get(sniperRoleID);
        const snipers = sniperRole.members.map(m => m.user.username).join('\n');
        await interaction.reply(`**Members with Sniper Role:**\n${snipers}`);
    } else if (commandName === 'updatesnipers') {
        const sniperRole = guild.roles.cache.get(sniperRoleID);
        const snipers = sniperRole.members.map(m => m.user);
        const stats = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        snipers.forEach(user => {
            if (!stats[user.id]) {
                stats[user.id] = {
                    name: user.username,
                    'snipe count': 0,
                    'death count': 0,
                    emojis: ''
                };
            }
        });

        fs.writeFileSync(filePath, JSON.stringify(stats, null, 2));
        await interaction.reply('Snipers updated.');
    } else if (commandName === 'stats') {
        const user = options.getUser('user') || member.user;
        const stats = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (stats[user.id]) {
            const { 'snipe count': snipeCount, 'death count': deathCount, emojis } = stats[user.id];
            await interaction.reply(`**${user.username}** has **${snipeCount} snipes** and **${deathCount} deaths**\n\n${emojis}`);
        } else {
            await interaction.reply(`${user.username} has no recorded stats.`);
        }
    } else if (commandName === 'leaderboard') {
        const stats = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const snipeLeaderboard = Object.values(stats)
            .sort((a, b) => b['snipe count'] - a['snipe count'])
            .map((s, i) => `${i + 1}. **${s.name}** – ${s['snipe count']} snipes`)
            .join('\n');
        const deathLeaderboard = Object.values(stats)
            .sort((a, b) => b['death count'] - a['death count'])
            .map((s, i) => `${i + 1}. **${s.name}** – ${s['death count']} deaths`)
            .join('\n');

        await interaction.reply(`**🏆 Snipe Leaderboard 🏆**\n${snipeLeaderboard}\n\n**💀 Death Leaderboard 💀**\n${deathLeaderboard}`);
    }
});

client.on('messageCreate', async message => {
    if (message.channel.name !== 'sniped' || message.author.bot) return;

    const member = message.member;
    const mentionedMembers = message.mentions.members;
    const attachments = message.attachments;

    if (attachments.size > 0 && member.roles.cache.has(sniperRoleID) && mentionedMembers.size > 0) {
        let validSnipe = true;

        mentionedMembers.forEach(m => {
            if (!m.roles.cache.has(sniperRoleID)) {
                message.reply("Invalid snipe, no sniping non-snipers!");
                validSnipe = false;
            }
        });

        if (validSnipe) {
            const mentionedNames = mentionedMembers.map(m => `**${m.displayName}**`).join(', ');
            const reply = await message.reply(`🔫  **${member.displayName}** just sniped ${mentionedNames}!  🔫`);

            const row = new ActionRowBuilder().addComponents(flagButton);
            await reply.edit({ components: [row] });

            const stats = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            stats[member.id]['snipe count'] += 1;
            stats[member.id]['emojis'] += '🏆';

            mentionedMembers.forEach(m => {
                stats[m.id]['death count'] += 1;
                stats[m.id]['emojis'] += '💀';
            });

            fs.writeFileSync(filePath, JSON.stringify(stats, null, 2));
        }
    } else if (attachments.size > 0 && mentionedMembers.size === 0) {
        message.reply("You must mention the person you're sniping in the same message!");
    }
});

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

    // fixing stats
    mentioned.forEach(member => {
        jsonStats[member.id]["death count"] -= 1;
        jsonStats[member.id]["emojis"] += "😇";
      });
    jsonStats[sender.id]["snipe count"] -= 1;
    jsonStats[sender.id]["emojis"] += "🏴";
    const updatedJsonStats = JSON.stringify(jsonStats, null, 2);
    fs.writeFileSync(filePath, updatedJsonStats, 'utf8');

    // replying with illegal notification
    repliedMessage.reply("🚩 Snipe flagged as illegal! All decisions are final! 🚩");
    reaction.message.delete();
});

client.login(TOKEN);