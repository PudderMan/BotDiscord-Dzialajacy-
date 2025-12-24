const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin_reset')
        .setDescription('CAŁKOWITY RESET BAZY DANYCH (Tylko Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            db.prepare('DELETE FROM players').run();
            // Opcjonalnie czyścimy też plik bazy
            db.prepare('VACUUM').run();
            await interaction.reply({ content: '✅ Baza danych została pomyślnie wyczyszczona!', ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ Błąd podczas resetowania bazy.', ephemeral: true });
        }
    }
};