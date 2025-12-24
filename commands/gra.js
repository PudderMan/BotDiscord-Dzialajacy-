const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../database.js');
const gameConfig = require('../config-gry.json');

let dropClicks = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gra')
        .setDescription('Uruchamia panel sylwestrowego clickera'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🎆 Wielkie Przygotowania do Sylwestra!')
            .setDescription('Potrzebujemy prochu na największy pokaz fajerwerków!\n\nKliknij przycisk poniżej, aby otrzymać własny kanał i zacząć zabawę!')
            .setColor(gameConfig.gfx.color)
            .setFooter({ text: 'Sylwestrowy Bot 2025' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('start_game')
                .setLabel('Zacznij zbierać proch! 🧨')
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async spawnDrop(client) {
        const channelId = process.env.DROP_CHANNEL_ID;
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) return;

        const dropEmbed = new EmbedBuilder()
            .setTitle('📦 GIGA ZRZUT PIROTECHNICZNY!')
            .setDescription(`Kto pierwszy kliknie przycisk **${gameConfig.drop.required_clicks} razy**, zgarnie **${gameConfig.drop.reward}g prochu**!`)
            .setColor('#00FFFF')
            .setImage('https://media.tenor.com/7vY6L59W9mYAAAAC/ralph-wiggum-sparkler.gif');

        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_drop').setLabel('ŁAP PACZKĘ! 📦').setStyle(ButtonStyle.Primary)
        );

        await channel.send({ content: "📦 **UWAGA!** Pojawił się nowy zrzut!", embeds: [dropEmbed], components: [button] });
    },

    async handleInteraction(interaction) {
        const userId = interaction.user.id;
        
        let data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        if (!data) {
            db.prepare('INSERT INTO players (userId) VALUES (?)').run(userId);
            data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        }

        if (interaction.customId === 'claim_drop') {
            const msgId = interaction.message.id;
            const current = (dropClicks.get(msgId) || 0) + 1;
            dropClicks.set(msgId, current);

            if (current >= gameConfig.drop.required_clicks) {
                db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(gameConfig.drop.reward, userId);
                dropClicks.delete(msgId);
                await interaction.message.delete().catch(() => {});
                return interaction.channel.send(`🎉 **${interaction.user.username}** przechwycił zrzut!`);
            } else {
                return interaction.reply({ content: `Postęp: ${current}/${gameConfig.drop.required_clicks}`, ephemeral: true });
            }
        }

        if (interaction.customId === 'start_game') {
            const { guild } = interaction;
            const channel = await guild.channels.create({
                name: `sylwester-${interaction.user.username}`,
                parent: process.env.CATEGORY_ID,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ],
            });

            const gameEmbed = new EmbedBuilder()
                .setTitle('🥂 Twój Sylwestrowy Magazyn')
                .setImage(gameConfig.gfx.main_gif)
                .addFields(
                    { name: '✨ Proch:', value: `${data.proch}g`, inline: true },
                    { name: '🚀 Mnożnik:', value: `x${data.multiplier}`, inline: true }
                ).setColor(gameConfig.gfx.color);

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('click_proch').setLabel('Klikaj! 🧨').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('open_shop').setLabel('Sklep 🛒').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('firework_boom').setLabel('ODPAL (1M)').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ content: `Witaj ${interaction.user}!`, embeds: [gameEmbed], components: [buttons] });
            return interaction.reply({ content: `Twój kanał: ${channel}`, ephemeral: true });
        }

        if (interaction.customId === 'click_proch') {
            const gain = (1 + (data.zimne_ognie * gameConfig.boosts.zimne_ognie) + (data.piccolo * gameConfig.boosts.piccolo) + (data.szampan * gameConfig.boosts.szampan_procenty) + (data.wyrzutnia * gameConfig.boosts.wyrzutnia_pro)) * data.multiplier;
            db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(gain, userId);
            
            // ODŚWIEŻENIE DANYCH PO ZAPISIE
            data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);

            if (Math.random() < gameConfig.drop.chance) await this.spawnDrop(interaction.client);

            const oldEmbed = interaction.message.embeds[0];
            if (!oldEmbed) return interaction.reply({ content: "Błąd: Panel wygasł.", ephemeral: true });

            const newEmbed = EmbedBuilder.from(oldEmbed).setFields(
                { name: '✨ Proch:', value: `${data.proch}g`, inline: true },
                { name: '🚀 Mnożnik:', value: `x${data.multiplier}`, inline: true }
            );
            await interaction.update({ embeds: [newEmbed] }).catch(() => {});
        }

        if (interaction.customId === 'open_shop') {
            const shopEmbed = new EmbedBuilder()
                .setTitle('🛒 Sklep Sylwestrowy')
                .setDescription(`Twój proch: **${data.proch}g**`)
                .setColor('#2ECC71')
                .addFields(
                    { name: `🎇 Zimne ognie (${gameConfig.prices.zimne_ognie}g)`, value: `+${gameConfig.boosts.zimne_ognie}/klik`, inline: true },
                    { name: `🍾 Piccolo (${gameConfig.prices.piccolo}g)`, value: `+${gameConfig.boosts.piccolo}/klik`, inline: true },
                    { name: `🥂 Szampan % (${gameConfig.prices.szampan_procenty}g)`, value: `+${gameConfig.boosts.szampan_procenty}/klik`, inline: true },
                    { name: `🚀 Wyrzutnia (${gameConfig.prices.wyrzutnia_pro}g)`, value: `+${gameConfig.boosts.wyrzutnia_pro}/klik`, inline: true }
                );

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('buy_zimne').setLabel('Kup Zimne Ognie').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('buy_piccolo').setLabel('Kup Piccolo').setStyle(ButtonStyle.Secondary)
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('buy_szampan').setLabel('Kup Szampan %').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('buy_wyrzutnia').setLabel('Kup Wyrzutnię').setStyle(ButtonStyle.Secondary)
            );

            await interaction.reply({ embeds: [shopEmbed], components: [row1, row2], ephemeral: true });
        }

        // --- NAPRAWIONA LOGIKA ZAKUPÓW ---
        const buy = async (price, col, label) => {
            // Zawsze sprawdzaj najświeższe dane z bazy przed zakupem
            let freshData = db.prepare('SELECT proch FROM players WHERE userId = ?').get(userId);
            if (freshData.proch < price) return interaction.reply({ content: `Brak środków! Masz ${freshData.proch}g, potrzebujesz ${price}g.`, ephemeral: true });
            
            db.prepare(`UPDATE players SET proch = proch - ?, ${col} = ${col} + 1 WHERE userId = ?`).run(price, userId);
            await interaction.reply({ content: `Kupiono: ${label}!`, ephemeral: true });
        };

        if (interaction.customId === 'buy_zimne') await buy(gameConfig.prices.zimne_ognie, 'zimne_ognie', 'Zimne ognie');
        if (interaction.customId === 'buy_piccolo') await buy(gameConfig.prices.piccolo, 'piccolo', 'Piccolo');
        if (interaction.customId === 'buy_szampan') await buy(gameConfig.prices.szampan_procenty, 'szampan', 'Szampan %');
        if (interaction.customId === 'buy_wyrzutnia') await buy(gameConfig.prices.wyrzutnia_pro, 'wyrzutnia', 'Wyrzutnię');

        if (interaction.customId === 'firework_boom') {
            if (data.proch < gameConfig.prices.prestige_req) return interaction.reply({ content: `Wymagane ${gameConfig.prices.prestige_req}g!`, ephemeral: true });
            db.prepare('UPDATE players SET proch = 0, zimne_ognie = 0, piccolo = 0, szampan = 0, wyrzutnia = 0, multiplier = multiplier * ? WHERE userId = ?').run(gameConfig.boosts.prestige_multiplier, userId);
            await interaction.reply({ content: '🎆 **WIELKI WYSTRZAŁ!**' });
        }
    }
};