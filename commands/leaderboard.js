const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const dotenv = require('dotenv');
const { getLeaderboardData } = require('../filemanagement.js');

dotenv.config();

const defaultColour = process.env.EMBED_COLOUR ?? '#7D6D78';

function generateLeaderboard(userInteraction, isSlash) {
    const serverName = userInteraction.guild.name;
    let meowDb = getLeaderboardData(serverName);
    
    if (!meowDb || meowDb.length === 0) {
        let noMeowMessage = "guys,, you gotta step up your meowing game >_<!! there's no tracked meows in the current server,,";
        if (!isSlash) {
            return userInteraction.channel.send(noMeowMessage);
        } else {
            return noMeowMessage;
        }
    }

    leaderboardNum = meowDb.length;
    if (meowDb.length > 10) {
        leaderboardNum = 10;
    }

    let leaderboardFields = []
    for (let i = 0; i < leaderboardNum; i++) {
        leaderboardFields.push({name: `#${i+1} | ${meowDb[i].user}`, value: `${meowDb[i].totalCount} ${meowDb[i].totalCount === 1? "meow" : "meows"}`})
    }


    let leaderboardEmbed = new EmbedBuilder()
    .setTitle('meow leaderboard:')
    .setThumbnail('https://cdn.discordapp.com/avatars/1340778139886031008/56508c96af2eb1afa323d3b87e3e7f1d') //bot pfp
    .setColor(defaultColour)
    .addFields(leaderboardFields)
    
    let returnText = { embeds: [leaderboardEmbed] }
    if (!isSlash) {
        return userInteraction.channel.send(returnText);
    } else {
        return returnText;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('displays a leaderboard of whoever has meowed the most in the server :0'),
    async execute(interaction) {
        await interaction.reply(generateLeaderboard(interaction.channel, true));
    },
    generateLeaderboard
};