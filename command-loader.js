const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('./database.js');
const gameConfig = require('../config-gry.json'); // Import konfiguracji

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gra')
        .setDescription('Uruchamia panel sylwestrowego clickera'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🎆 Sylwestrowe Przygotowania')
            .setDescription('Zacznij zbierać proch na wielki pokaz!')
            .setColor(gameConfig.gfx.color);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_game').setLabel('Stwórz kanał gry 🧨').setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleInteraction(interaction) {
        const userId = interaction.user.id;
        let data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId) || { proch: 0, multiplier: 1, zimne_ognie: 0, piccolo: 0, szampan: 0, wyrzutnia: 0 };

        if (!db.prepare('SELECT userId FROM players WHERE userId = ?').get(userId)) {
            db.prepare('INSERT INTO players (userId) VALUES (?)').run(userId);
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
                .setTitle('🥂 Twój Magazyn Pirotechnika')
                .setImage(gameConfig.gfx.main_gif)
                .addFields(
                    { name: '✨ Proch:', value: `${data.proch}g`, inline: true },
                    { name: '🚀 Mnożnik:', value: `x${data.multiplier}`, inline: true }
                )
                .setColor(gameConfig.gfx.color);

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('click_proch').setLabel('KLIKAJ 🧨').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('open_shop').setLabel('SKLEP 🛒').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('firework_boom').setLabel('ODPAL FAJERWERKĘ 🎇').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ embeds: [gameEmbed], components: [buttons] });
            return interaction.reply({ content: `Kanał: ${channel}`, ephemeral: true });
        }

        // --- KLIKANIE ---
        if (interaction.customId === 'click_proch') {
            const gain = (1 + 
                (data.zimne_ognie * gameConfig.boosts.zimne_ognie) + 
                (data.piccolo * gameConfig.boosts.piccolo) + 
                (data.szampan * gameConfig.boosts.szampan_procenty) +
                (data.wyrzutnia * gameConfig.boosts.wyrzutnia_pro)
            ) * data.multiplier;

            db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(gain, userId);
            
            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .setFields(
                    { name: '✨ Proch:', value: `${data.proch + gain}g`, inline: true },
                    { name: '🚀 Mnożnik:', value: `x${data.multiplier}`, inline: true }
                );

            await interaction.update({ embeds: [embed] });
        }

        // --- OTWARCIE SKLEPU ---
        if (interaction.customId === 'open_shop') {
            const shopEmbed = new EmbedBuilder()
                .setTitle('🛒 Sklep u Janusza')
                .setDescription('Wybierz sprzęt, by szybciej zbierać proch!')
                .addFields(
                    { name: `🎇 Zimne ognie (${gameConfig.prices.zimne_ognie}g)`, value: `+${gameConfig.boosts.zimne_ognie}/klik`, inline: true },
                    { name: `🍾 Piccolo (${gameConfig.prices.piccolo}g)`, value: `+${gameConfig.boosts.piccolo}/klik`, inline: true },
                    { name: `🥂 Szampan % (${gameConfig.prices.szampan_procenty}g)`, value: `+${gameConfig.boosts.szampan_procenty}/klik`, inline: true },
                    { name: `🚀 Wyrzutnia (${gameConfig.prices.wyrzutnia_pro}g)`, value: `+${gameConfig.boosts.wyrzutnia_pro}/klik`, inline: true }
                );

            const shopRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('buy_zimne').setLabel('Zimne ognie').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('buy_piccolo').setLabel('Piccolo').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('buy_szampan').setLabel('Szampan %').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('buy_wyrzutnia').setLabel('Wyrzutnia').setStyle(ButtonStyle.Secondary)
            );

            await interaction.reply({ embeds: [shopEmbed], components: [shopRow], ephemeral: true });
        }

        // --- LOGIKA KUPNA (Przykład dla Zimnych Ogni) ---
        if (interaction.customId === 'buy_zimne') {
            if (data.proch < gameConfig.prices.zimne_ognie) return interaction.reply({ content: 'Brak prochu!', ephemeral: true });
            
            db.prepare('UPDATE players SET proch = proch - ?, zimne_ognie = zimne_ognie + 1 WHERE userId = ?')
              .run(gameConfig.prices.zimne_ognie, userId);
            
            await interaction.reply({ content: 'Kupiono zimne ognie! Twój zysk rośnie.', ephemeral: true });
        }
        
        // Logika dla reszty przedmiotów analogicznie...
        
        // --- PRESTIŻ ---
        if (interaction.customId === 'firework_boom') {
            if (data.proch < gameConfig.prices.prestige_req) return interaction.reply({ content: `Potrzebujesz ${gameConfig.prices.prestige_req}g prochu!`, ephemeral: true });
            
            db.prepare('UPDATE players SET proch = 0, zimne_ognie = 0, piccolo = 0, szampan = 0, wyrzutnia = 0, multiplier = multiplier * ? WHERE userId = ?')
              .run(gameConfig.boosts.prestige_multiplier, userId);
            
            await interaction.reply({ content: `🎆 **BOOM!** Wystrzeliłeś fajerwerkę! Twój mnożnik to teraz x${data.multiplier * 10}!` });
        }
    }
};