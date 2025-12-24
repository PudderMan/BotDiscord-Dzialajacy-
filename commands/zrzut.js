const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const gra = require('./gra.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('zrzut')
        .setDescription('Manualnie wywołuje zrzut fajerwerków')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await gra.spawnDrop(interaction.client);
        await interaction.reply({ content: 'Zrzut wysłany!', ephemeral: true });
    }
};