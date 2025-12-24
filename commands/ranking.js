const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('Pokazuje TOP 10 pirotechników'),

    async execute(interaction) {
        const topPlayers = db.prepare('SELECT userId, proch FROM players ORDER BY proch DESC LIMIT 10').all();
        
        if (topPlayers.length === 0) return interaction.reply('Baza danych jest pusta!');

        const embed = new EmbedBuilder()
            .setTitle('🏆 Ranking Najlepszych Pirotechników')
            .setColor('#FFD700')
            .setDescription(
                topPlayers.map((user, index) => {
                    return `**${index + 1}.** <@${user.userId}> — \`${user.proch}g\` prochu`;
                }).join('\n')
            );

        await interaction.reply({ embeds: [embed] });
    }
};