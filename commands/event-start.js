const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
// Ta linia mówi: wyjdź z folderu 'commands' (../) i szukaj pliku w folderze głównym
const eventSystem = require('../events-system.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('eventstart')
        .setDescription('Ręcznie uruchamia losowe pytanie eventowe')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // Próba wywołania funkcji z pliku głównego
            await eventSystem.triggerManual(interaction.client);
            
            await interaction.reply({ 
                content: '✅ Pytanie eventowe zostało wysłane na kanał!', 
                ephemeral: true 
            });
        } catch (error) {
            console.error("Błąd komendy eventstart:", error);
            await interaction.reply({ 
                content: '❌ Nie udało się uruchomić eventu. Upewnij się, że plik events-system.js jest w folderze głównym.', 
                ephemeral: true 
            });
        }
    },
};