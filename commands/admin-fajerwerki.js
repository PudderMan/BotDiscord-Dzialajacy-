const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-dodaj')
        .setDescription('Dodaj walutę wybranemu graczowi (ADMIN)')
        .addUserOption(opt => opt.setName('cel').setDescription('Gracz, któremu dodajesz').setRequired(true))
        .addStringOption(opt => opt.setName('typ')
            .setDescription('Co chcesz dodać?')
            .setRequired(true)
            .addChoices(
                { name: '✨ Proch', value: 'proch' },
                { name: '🎇 Fajerwerki', value: 'fajerwerki_waluta' }
            ))
        .addIntegerOption(opt => opt.setName('ilosc').setDescription('Ilość do dodania').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const target = interaction.options.getUser('cel');
        const type = interaction.options.getString('typ');
        const amount = interaction.options.getInteger('ilosc');

        const data = db.prepare('SELECT userId FROM players WHERE userId = ?').get(target.id);
        if (!data) return interaction.reply({ content: "❌ Ten gracz nie zaczął jeszcze gry!", ephemeral: true });

        // Dodawanie wartości do obecnego stanu (nie nadpisywanie)
        db.prepare(`UPDATE players SET ${type} = ${type} + ? WHERE userId = ?`).run(amount, target.id);
        
        const label = type === 'proch' ? 'g prochu ✨' : '🎇';
        return interaction.reply({ 
            content: `✅ Dodano **${amount} ${label}** dla użytkownika ${target.username}.`, 
            ephemeral: true 
        });
    }
};