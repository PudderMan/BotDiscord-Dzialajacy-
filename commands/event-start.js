const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
// Używamy ./ ponieważ oba pliki są w folderze /commands/
const eventSystem = require('./events-system.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('eventstart')
        .setDescription('Ręcznie uruchamia pytanie eventowe')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Log, żeby widzieć w konsoli czy komenda w ogóle "odpala"
        console.log("-> Wywołano komendę /eventstart");
        
        try {
            await eventSystem.triggerEvent(interaction.client);
            await interaction.reply({ content: '✅ Próba wysłania ogłoszenia...', ephemeral: true });
        } catch (error) {
            console.error("Błąd w execute komendy:", error);
            await interaction.reply({ content: '❌ Błąd podczas uruchamiania.', ephemeral: true });
        }
    },
};