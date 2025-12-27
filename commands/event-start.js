const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
// Zakładając, że events-system.js jest w głównym folderze, a ta komenda w /commands/
const eventSystem = require('../events-system.js'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('eventstart')
        .setDescription('Ręcznie uruchamia losowe pytanie eventowe')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Używamy interaction.client, żeby przekazać bota do systemu eventów
        await eventSystem.triggerManual(interaction.client);
        
        await interaction.reply({ 
            content: '✅ Pytanie eventowe zostało wysłane na kanał ogłoszeń!', 
            ephemeral: true 
        });
    },
};