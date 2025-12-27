const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
// Używamy ./ ponieważ plik jest w tym samym folderze co ta komenda
const eventSystem = require('./events-system.js'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('eventstart')
        .setDescription('Ręcznie uruchamia losowe pytanie eventowe')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await eventSystem.triggerManual(interaction.client);
            await interaction.reply({ content: '✅ Event wystartował!', ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Błąd modułu.', ephemeral: true });
        }
    },
};