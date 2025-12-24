const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gra')
        .setDescription('Uruchamia panel sylwestrowego clickera'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🎆 Wielkie Przygotowania do Sylwestra!')
            .setDescription('Potrzebujemy prochu na największy pokaz fajerwerków w historii! \n\nKliknij przycisk poniżej, aby otrzymać własny kanał i zacząć produkcję.')
            .setColor('#2f3136')
            .setFooter({ text: 'Sylwestrowy Bot 2025' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('start_game')
                .setLabel('Zacznij zbierać proch! 🧨')
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleInteraction(interaction) {
        const userId = interaction.user.id;

        // Inicjalizacja gracza w bazie jeśli nie istnieje
        let data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        if (!data) {
            db.prepare('INSERT INTO players (userId) VALUES (?)').run(userId);
            data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        }

        // --- TWORZENIE KANAŁU ---
        if (interaction.customId === 'start_game') {
            const channel = await interaction.guild.channels.create({
                name: `sylwester-${interaction.user.username}`,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ],
            });

            const gameEmbed = new EmbedBuilder()
                .setTitle('🥂 Twój Sylwestrowy Magazyn')
                .setDescription('Klikaj w 🧨, aby zbierać proch. Kupuj ulepszenia, by przyspieszyć pracę!')
                .addFields(
                    { name: '✨ Proch:', value: `${data.proch}g`, inline: true },
                    { name: '🚀 Mnożnik:', value: `x${data.multiplier}`, inline: true },
                    { name: '🍾 Piccolo:', value: `${data.piccolo} szt.`, inline: true }
                )
                .setImage('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJpY2NqZ3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3R4Z3ImZXA9djFfaW50ZXJuYWxfZ2lmX2J5X2lkJmN0PWc/26tOZ42Mg6pbMubM4/giphy.gif')
                .setColor('#FF4500');

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('click_proch').setLabel('Klikaj! 🧨').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('buy_piccolo').setLabel('Piccolo (100g)').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('buy_szampan').setLabel('Szampan % (1000g)').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('firework_boom').setLabel('ODPAL (1M)').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ content: `Witaj ${interaction.user}! Twoja strefa przygotowań jest gotowa.`, embeds: [gameEmbed], components: [buttons] });
            return interaction.reply({ content: `Twój kanał: ${channel}`, ephemeral: true });
        }

        // --- KLIKANIE ---
        if (interaction.customId === 'click_proch') {
            const gain = (1 + (data.piccolo * 1) + (data.szampan * 10)) * data.multiplier;
            db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(gain, userId);
            
            const updatedProch = data.proch + gain;

            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .setFields(
                    { name: '✨ Proch:', value: `${updatedProch}g`, inline: true },
                    { name: '🚀 Mnożnik:', value: `x${data.multiplier}`, inline: true },
                    { name: '🍾 Piccolo:', value: `${data.piccolo} szt.`, inline: true }
                );

            await interaction.update({ embeds: [embed] });
        }

        // --- KUPNO PICCOLO ---
        if (interaction.customId === 'buy_piccolo') {
            if (data.proch < 100) return interaction.reply({ content: 'Nie masz wystarczająco prochu (100g)!', ephemeral: true });

            db.prepare('UPDATE players SET proch = proch - 100, piccolo = piccolo + 1 WHERE userId = ?').run(userId);
            await interaction.reply({ content: 'Zakupiono Szampan Piccolo! (+1 do kliknięcia)', ephemeral: true });
        }

        // --- KUPNO SZAMPANA % ---
        if (interaction.customId === 'buy_szampan') {
            if (data.proch < 1000) return interaction.reply({ content: 'Nie masz wystarczająco prochu (1000g)!', ephemeral: true });

            db.prepare('UPDATE players SET proch = proch - 1000, szampan = szampan + 1 WHERE userId = ?').run(userId);
            await interaction.reply({ content: 'Zakupiono Szampan z %! (+10 do kliknięcia)', ephemeral: true });
        }

        // --- PRESTIŻ (ODPALENIE FAJERWERKI) ---
        if (interaction.customId === 'firework_boom') {
            if (data.proch < 1000000) return interaction.reply({ content: 'Potrzebujesz 1,000,000g prochu, by odpalić tę fajerwerkę!', ephemeral: true });

            db.prepare('UPDATE players SET proch = 0, piccolo = 0, szampan = 0, multiplier = multiplier * 10 WHERE userId = ?').run(userId);
            
            const prestigeEmbed = new EmbedBuilder()
                .setTitle('🎆 WIELKIE BUM!')
                .setDescription(`${interaction.user} wystrzelił potężną fajerwerkę! \n\n**Otrzymujesz stały mnożnik x10 do wszystkich zarobków!**`)
                .setColor('#FFD700');

            await interaction.reply({ embeds: [prestigeEmbed] });
        }
    }
};