const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const eventSystem = require('./events-system.js'); // upewnij się, że ścieżka jest poprawna

module.exports = {
    data: new SlashCommandBuilder()
        .setName('eventstart')
        .setDescription('Ręcznie uruchamia losowe pytanie eventowe')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await eventSystem.triggerEvent(interaction.client);
        await interaction.reply({ content: '✅ Event został uruchomiony!', ephemeral: true });
    },
};