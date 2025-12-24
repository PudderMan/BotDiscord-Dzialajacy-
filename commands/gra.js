const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../database.js');
const gameConfig = require('../config-gry.json');

// Mapa do śledzenia kliknięć w zrzuty (globalna w ramach pliku)
let dropClicks = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gra')
        .setDescription('Uruchamia panel sylwestrowego clickera'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🎆 Wielkie Przygotowania do Sylwestra!')
            .setDescription('Potrzebujemy prochu na największy pokaz fajerwerków!\n\nKliknij przycisk poniżej, aby otrzymać własny kanał. **Uwaga:** Kanał startowy zostanie dla Ciebie ukryty!')
            .setColor(gameConfig.gfx.color);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_game').setLabel('Zacznij zbierać proch! 🧨').setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    // Komenda /zrzut dla admina (dodamy ją do loadera)
    async spawnDrop(client) {
        const channel = await client.channels.fetch(process.env.DROP_CHANNEL_ID);
        if (!channel) return console.error("Nie znaleziono kanału zrzutów!");

        const dropEmbed = new EmbedBuilder()
            .setTitle('📦 GIGA ZRZUT PIROTECHNICZNY!')
            .setDescription(`Kto pierwszy kliknie przycisk **${gameConfig.drop.required_clicks} razy**, zgarnie **${gameConfig.drop.reward}g prochu**!`)
            .setColor('#00FFFF')
            .setImage('https://media.giphy.com/media/3o7TKVUn7iM8FMEU24/giphy.gif');

        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_drop').setLabel('ŁAP PACZKĘ! 📦').setStyle(ButtonStyle.Primary)
        );

        await channel.send({ content: "@everyone UWAGA! ZRZUT!", embeds: [dropEmbed], components: [button] });
    },

    async handleInteraction(interaction) {
        const userId = interaction.user.id;
        let data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        if (!data) {
            db.prepare('INSERT INTO players (userId) VALUES (?)').run(userId);
            data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        }

        // --- ZRZUTY (Obsługa kliknięcia) ---
        if (interaction.customId === 'claim_drop') {
            const msgId = interaction.message.id;
            const current = (dropClicks.get(msgId) || 0) + 1;
            dropClicks.set(msgId, current);

            if (current >= gameConfig.drop.required_clicks) {
                db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(gameConfig.drop.reward, userId);
                dropClicks.delete(msgId);
                await interaction.message.delete();
                return interaction.channel.send(`🎉 **${interaction.user.username}** przechwycił zrzut i zyskał **${gameConfig.drop.reward}g** prochu!`);
            } else {
                return interaction.reply({ content: `Kliknięto ${current}/${gameConfig.drop.required_clicks}!`, ephemeral: true });
            }
        }

        // --- TWORZENIE KANAŁU ---
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
            } catch (e) { console.error("Ranga error:", e); }

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
                new ButtonBuilder().setCustomId('firework_boom').setLabel('ODPAL (1M) 🎇').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ embeds: [gameEmbed], components: [buttons] });
            return interaction.reply({ content: `Powodzenia! Twój kanał: ${channel}`, ephemeral: true });
        }

        // --- KLIKANIE I EVENTY ---
        if (interaction.customId === 'click_proch') {
            const gain = (1 + (data.zimne_ognie * gameConfig.boosts.zimne_ognie) + (data.piccolo * gameConfig.boosts.piccolo) + (data.szampan * gameConfig.boosts.szampan_procenty) + (data.wyrzutnia * gameConfig.boosts.wyrzutnia_pro)) * data.multiplier;
            
            db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(gain, userId);
            
            // Losowy event
            if (Math.random() < 0.05) {
                const change = 500; // Uproszczony przykład
                db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(change, userId);
                await interaction.followUp({ content: `🧨 Znalazłeś dodatkowe ${change}g prochu na ziemi!`, ephemeral: true });
            }

            // Szansa na automatyczny zrzut przy kliknięciu (globalny)
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

        // --- SKLEP I PRESTIŻ (Logika z poprzednich kroków...) ---
        if (interaction.customId === 'open_shop') {
            const shopEmbed = new EmbedBuilder()
                .setTitle('🛒 Sklep')
                .addFields(
                    { name: `Zimne ognie (${gameConfig.prices.zimne_ognie}g)`, value: `+${gameConfig.boosts.zimne_ognie}`, inline: true },
                    { name: `Piccolo (${gameConfig.prices.piccolo}g)`, value: `+${gameConfig.boosts.piccolo}`, inline: true }
                );
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('buy_zimne').setLabel('Kup Zimne Ognie').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('buy_piccolo').setLabel('Kup Piccolo').setStyle(ButtonStyle.Secondary)
            );
            await interaction.reply({ embeds: [shopEmbed], components: [row], ephemeral: true });
        }
        
        // Logika kupowania... (db.prepare('UPDATE...'))
        if (interaction.customId === 'buy_zimne') {
            if (data.proch < gameConfig.prices.zimne_ognie) return interaction.reply({ content: "Za mało prochu!", ephemeral: true });
            db.prepare('UPDATE players SET proch = proch - ?, zimne_ognie = zimne_ognie + 1 WHERE userId = ?').run(gameConfig.prices.zimne_ognie, userId);
            await interaction.reply({ content: "Kupiono!", ephemeral: true });
        }
        
        if (interaction.customId === 'firework_boom') {
            if (data.proch < gameConfig.prices.prestige_req) return interaction.reply({ content: "Za mało prochu na prestiż!", ephemeral: true });
            db.prepare('UPDATE players SET proch = 0, zimne_ognie = 0, piccolo = 0, multiplier = multiplier * ? WHERE userId = ?').run(gameConfig.boosts.prestige_multiplier, userId);
            await interaction.reply({ content: "🎆 BOOM! Prestiż zdobyty!" });
        }
    }
};