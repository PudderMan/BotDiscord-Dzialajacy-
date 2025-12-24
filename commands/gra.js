const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../database.js'); // Tu zostają dwie kropki, bo wychodzimy z folderu commands
const gameConfig = require('../config-gry.json');

let dropClicks = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gra')
        .setDescription('Uruchamia panel sylwestrowego clickera'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🎆 Wielkie Przygotowania do Sylwestra!')
            .setDescription('Kliknij przycisk poniżej, aby otrzymać własny kanał.\n**Uwaga:** Ten kanał zostanie przed Tobą ukryty po starcie!')
            .setColor(gameConfig.gfx.color);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_game').setLabel('Zacznij zbierać proch! 🧨').setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async spawnDrop(client) {
        const channelId = process.env.DROP_CHANNEL_ID;
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) return console.error("Nie znaleziono kanału zrzutów!");

        const dropEmbed = new EmbedBuilder()
            .setTitle('📦 GIGA ZRZUT PIROTECHNICZNY!')
            .setDescription(`Pierwsza osoba, która kliknie **${gameConfig.drop.required_clicks} razy**, zgarnia **${gameConfig.drop.reward}g prochu**!`)
            .setColor('#00FFFF')
            .setImage('https://media.giphy.com/media/3o7TKVUn7iM8FMEU24/giphy.gif');

        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_drop').setLabel('ŁAP PACZKĘ! 📦').setStyle(ButtonStyle.Primary)
        );

        await channel.send({ content: "@everyone ZRZUT!", embeds: [dropEmbed], components: [button] });
    },

    async handleInteraction(interaction) {
        const userId = interaction.user.id;
        
        let data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        if (!data) {
            db.prepare('INSERT INTO players (userId) VALUES (?)').run(userId);
            data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        }

        // Obsługa ZRZUTU
        if (interaction.customId === 'claim_drop') {
            const current = (dropClicks.get(interaction.message.id) || 0) + 1;
            dropClicks.set(interaction.message.id, current);

            if (current >= gameConfig.drop.required_clicks) {
                db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(gameConfig.drop.reward, userId);
                dropClicks.delete(interaction.message.id);
                await interaction.message.delete().catch(() => {});
                return interaction.channel.send(`🎉 **${interaction.user.username}** wygrał zrzut! (+${gameConfig.drop.reward}g)`);
            } else {
                return interaction.reply({ content: `Postęp: ${current}/${gameConfig.drop.required_clicks}`, ephemeral: true });
            }
        }

        // TWORZENIE KANAŁU
        if (interaction.customId === 'start_game') {
            const channel = await interaction.guild.channels.create({
                name: `sylwester-${interaction.user.username}`,
                parent: process.env.CATEGORY_ID,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ],
            });

            try {
                const role = interaction.guild.roles.cache.get(process.env.BLOCKED_ROLE_ID);
                if (role) await interaction.member.roles.add(role);
            } catch (e) {}

            const gameEmbed = new EmbedBuilder()
                .setTitle('🥂 Twój Sylwestrowy Magazyn')
                .setImage(gameConfig.gfx.main_gif)
                .addFields(
                    { name: '✨ Proch:', value: `${data.proch}g`, inline: true },
                    { name: '🚀 Mnożnik:', value: `x${data.multiplier}`, inline: true }
                ).setColor(gameConfig.gfx.color);

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('click_proch').setLabel('KLIKAJ 🧨').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('open_shop').setLabel('SKLEP 🛒').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('firework_boom').setLabel('ODPAL (1M) 🎇').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ embeds: [gameEmbed], components: [buttons] });
            return interaction.reply({ content: `Twoja strefa: ${channel}`, ephemeral: true });
        }

        // KLIKANIE
        if (interaction.customId === 'click_proch') {
            const gain = (1 + (data.zimne_ognie * gameConfig.boosts.zimne_ognie) + (data.piccolo * gameConfig.boosts.piccolo) + (data.szampan * gameConfig.boosts.szampan_procenty) + (data.wyrzutnia * gameConfig.boosts.wyrzutnia_pro)) * data.multiplier;
            db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(gain, userId);
            
            // Szansa na zrzut
            if (Math.random() < gameConfig.drop.chance) await this.spawnDrop(interaction.client);

            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .setFields(
                    { name: '✨ Proch:', value: `${data.proch + gain}g`, inline: true },
                    { name: '🚀 Mnożnik:', value: `x${data.multiplier}`, inline: true }
                );
            await interaction.update({ embeds: [embed] });
        }

        // SKLEP
        if (interaction.customId === 'open_shop') {
            const shopEmbed = new EmbedBuilder()
                .setTitle('🛒 Sklep Sylwestrowy')
                .setDescription(`Twój proch: ${data.proch}g`)
                .addFields(
                    { name: '🎇 Zimne Ognie', value: `Cena: ${gameConfig.prices.zimne_ognie}g`, inline: true },
                    { name: '🍾 Piccolo', value: `Cena: ${gameConfig.prices.piccolo}g`, inline: true }
                );
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('buy_zimne').setLabel('Zimne Ognie').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('buy_piccolo').setLabel('Piccolo').setStyle(ButtonStyle.Secondary)
            );
            await interaction.reply({ embeds: [shopEmbed], components: [row], ephemeral: true });
        }

        // Zakupy (uproszczone)
        if (interaction.customId === 'buy_zimne') {
            if (data.proch < gameConfig.prices.zimne_ognie) return interaction.reply({ content: 'Brak środków!', ephemeral: true });
            db.prepare('UPDATE players SET proch = proch - ?, zimne_ognie = zimne_ognie + 1 WHERE userId = ?').run(gameConfig.prices.zimne_ognie, userId);
            await interaction.reply({ content: 'Kupiono!', ephemeral: true });
        }

        if (interaction.customId === 'firework_boom') {
            if (data.proch < gameConfig.prices.prestige_req) return interaction.reply({ content: 'Potrzebujesz 1mln prochu!', ephemeral: true });
            db.prepare('UPDATE players SET proch = 0, zimne_ognie = 0, piccolo = 0, szampan = 0, wyrzutnia = 0, multiplier = multiplier * ? WHERE userId = ?').run(gameConfig.boosts.prestige_multiplier, userId);
            await interaction.reply({ content: '🎆 WIELKIE BUM! Mnożnik x10 zdobyty!' });
        }
    }
};