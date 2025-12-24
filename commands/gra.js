const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../database.js');
const gameConfig = require('../config-gry.json');

// Mapa do śledzenia kliknięć w zrzuty (globalna dla pliku)
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

    // Funkcja do wywoływania zrzutu (używana przez /zrzut i losowo)
    async spawnDrop(client) {
        const channelId = process.env.DROP_CHANNEL_ID;
        const channel = await client.channels.fetch(channelId).catch(() => null);
        
        if (!channel) return console.error("Nie znaleziono kanału zrzutów! Sprawdź .env");

        const dropEmbed = new EmbedBuilder()
            .setTitle('📦 GIGA ZRZUT PIROTECHNICZNY!')
            .setDescription(`Kto pierwszy kliknie przycisk **${gameConfig.drop.required_clicks} razy**, zgarnie **${gameConfig.drop.reward}g prochu**!`)
            .setColor('#00FFFF')
            .setImage('https://tenor.com/view/yeah-ralph-wiggum-sparkler-4th-of-july-independence-day-gif-26112196');

        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_drop').setLabel('ŁAP PACZKĘ! 📦').setStyle(ButtonStyle.Primary)
        );

        // USUNIĘTO @everyone
        await channel.send({ content: "📦 **UWAGA!** Pojawił się nowy zrzut!", embeds: [dropEmbed], components: [button] });
    },

    async handleInteraction(interaction) {
        const userId = interaction.user.id;
        
        // Pobranie danych gracza
        let data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        if (!data) {
            db.prepare('INSERT INTO players (userId) VALUES (?)').run(userId);
            data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        }

        // --- OBSŁUGA ZRZUTU ---
        if (interaction.customId === 'claim_drop') {
            const msgId = interaction.message.id;
            const current = (dropClicks.get(msgId) || 0) + 1;
            dropClicks.set(msgId, current);

            if (current >= gameConfig.drop.required_clicks) {
                db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(gameConfig.drop.reward, userId);
                dropClicks.delete(msgId);
                await interaction.message.delete().catch(() => {});
                return interaction.channel.send(`🎉 **${interaction.user.username}** przechwycił zrzut i zyskał **${gameConfig.drop.reward}g** prochu!`);
            } else {
                return interaction.reply({ content: `Kliknięto ${current}/${gameConfig.drop.required_clicks}!`, ephemeral: true });
            }
        }

        // --- TWORZENIE KANAŁU ---
        if (interaction.customId === 'start_game') {
            const { guild, member } = interaction;

            const channel = await guild.channels.create({
                name: `sylwester-${interaction.user.username}`,
                parent: process.env.CATEGORY_ID,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ],
            });

            try {
                const blockedRole = guild.roles.cache.get(process.env.BLOCKED_ROLE_ID);
                if (blockedRole) await member.roles.add(blockedRole);
            } catch (err) { console.error("Błąd przy nadawaniu rangi:", err); }

            const gameEmbed = new EmbedBuilder()
                .setTitle('🥂 Twój Sylwestrowy Magazyn')
                .setImage(gameConfig.gfx.main_gif)
                .addFields(
                    { name: '✨ Proch:', value: `${data.proch}g`, inline: true },
                    { name: '🚀 Mnożnik:', value: `x${data.multiplier}`, inline: true }
                )
                .setColor(gameConfig.gfx.color);

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('click_proch').setLabel('Klikaj! 🧨').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('open_shop').setLabel('Sklep 🛒').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('firework_boom').setLabel('ODPAL (1M)').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ content: `Witaj ${interaction.user}!`, embeds: [gameEmbed], components: [buttons] });
            return interaction.reply({ content: `Kanał stworzony: ${channel}`, ephemeral: true });
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
            
            // Losowe zdarzenie (5% szans)
            if (Math.random() < 0.05) {
                const bonus = 500;
                db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(bonus, userId);
                await interaction.followUp({ content: `🍀 Znalazłeś dodatkowe **${bonus}g** prochu!`, ephemeral: true });
            }

            // Szansa na automatyczny zrzut
            if (Math.random() < gameConfig.drop.chance) {
                await this.spawnDrop(interaction.client);
            }

            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .setFields(
                    { name: '✨ Proch:', value: `${data.proch + gain}g`, inline: true },
                    { name: '🚀 Mnożnik:', value: `x${data.multiplier}`, inline: true }
                );

            await interaction.update({ embeds: [embed] });
        }

        // --- SKLEP ---
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

        // --- OBSŁUGA ZAKUPÓW ---
        const handlePurchase = async (price, column, label) => {
            if (data.proch < price) return interaction.reply({ content: `Brak prochu! Potrzebujesz ${price}g.`, ephemeral: true });
            db.prepare(`UPDATE players SET proch = proch - ?, ${column} = ${column} + 1 WHERE userId = ?`).run(price, userId);
            await interaction.reply({ content: `Pomyślnie kupiono: ${label}!`, ephemeral: true });
        };

        if (interaction.customId === 'buy_zimne') await handlePurchase(gameConfig.prices.zimne_ognie, 'zimne_ognie', 'Zimne ognie');
        if (interaction.customId === 'buy_piccolo') await handlePurchase(gameConfig.prices.piccolo, 'piccolo', 'Piccolo');
        if (interaction.customId === 'buy_szampan') await handlePurchase(gameConfig.prices.szampan_procenty, 'szampan', 'Szampan %');
        if (interaction.customId === 'buy_wyrzutnia') await handlePurchase(gameConfig.prices.wyrzutnia_pro, 'wyrzutnia', 'Wyrzutnia');

        // --- PRESTIŻ ---
        if (interaction.customId === 'firework_boom') {
            if (data.proch < gameConfig.prices.prestige_req) {
                return interaction.reply({ content: `Za mało prochu! Potrzebujesz ${gameConfig.prices.prestige_req}g!`, ephemeral: true });
            }

            db.prepare('UPDATE players SET proch = 0, zimne_ognie = 0, piccolo = 0, szampan = 0, wyrzutnia = 0, multiplier = multiplier * ? WHERE userId = ?')
              .run(gameConfig.boosts.prestige_multiplier, userId);
            
            await interaction.reply({ content: '🎆 **WIELKI WYSTRZAŁ!** Twój mnożnik wzrósł permanentnie!', ephemeral: false });
        }
    }
};