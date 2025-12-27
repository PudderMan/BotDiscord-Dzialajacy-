const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
// Wychodzimy o jeden folder wyżej (z /commands/ do folderu głównego)
const eventSystem = require('../events-system.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('eventstart')
        .setDescription('Ręcznie uruchamia losowe pytanie eventowe')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // Przekazujemy clienta bota do systemu eventów
            await eventSystem.triggerManual(interaction.client);
            
            await interaction.reply({ 
                content: '✅ Pomyślnie wymuszono start pytania eventowego!', 
                ephemeral: true 
            });
        } catch (error) {
            console.error("Błąd podczas ręcznego startu eventu:", error);
            await interaction.reply({ 
                content: '❌ Wystąpił błąd podczas uruchamiania eventu. Sprawdź konsolę.', 
                ephemeral: true 
            });
        }
    },
};