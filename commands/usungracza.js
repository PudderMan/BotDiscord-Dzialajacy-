const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database.js'); //

module.exports = {
    data: new SlashCommandBuilder()
        .setName('usun-gracza')
        .setDescription('Całkowicie usuwa postęp gracza z bazy danych')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('Wybierz gracza do usunięcia')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Tylko dla adminów

    async execute(interaction) {
        const target = interaction.options.getUser('target');
        
        // Sprawdzenie czy gracz istnieje w bazie
        const player = db.prepare('SELECT * FROM players WHERE userId = ?').get(target.id); //

        if (!player) {
            return await interaction.reply({ 
                content: `❌ Użytkownik **${target.tag}** nie widnieje w bazie danych.`, 
                ephemeral: true 
            });
        }

        // Usunięcie rekordu
        db.prepare('DELETE FROM players WHERE userId = ?').run(target.id); //

        console.log(`🗑️ Admin ${interaction.user.tag} usunął z bazy gracza ${target.tag} (${target.id})`);

        await interaction.reply({ 
            content: `✅ Pomyślnie usunięto wszystkie dane gracza **${target.tag}**. Może on teraz zacząć grę od nowa.`, 
            ephemeral: false 
        });
    },
};