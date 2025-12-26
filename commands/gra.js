const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../database.js');
const gameConfig = require('../config-gry.json');

const formatNum = (n) => {
    if (n === undefined || n === null || isNaN(n)) return "0";
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return Math.floor(n).toString();
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gra')
        .setDescription('Główna komenda gry Sylwester 2025')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub.setName('panel').setDescription('Wysyła panel startowy')),

    async execute(interaction) {
        const embed = new EmbedBuilder().setTitle('🎆 Sylwester 2025').setDescription('Kliknij przycisk, aby otworzyć magazyn!').setColor(gameConfig.gfx.color);
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('start_game').setLabel('Zacznij Przygodę! 🧨').setStyle(ButtonStyle.Danger));
        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleInteraction(interaction) {
        const userId = interaction.user.id;
        let data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);

        if (!data) {
            db.prepare('INSERT INTO players (userId, proch, multiplier, mega_multiplier, total_fajerwerki, fajerwerki_waluta, dzik, max_dzik, zimne_ognie, piccolo, szampan, wyrzutnia, pudelko) VALUES (?, 10000, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0)').run(userId);
            data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        }

        const curMult = (Number(data.multiplier) + (Number(data.dzik) * gameConfig.boosts.dzik_val)) * Number(data.mega_multiplier);
        const nextPresPrice = gameConfig.prices.prestige_base * Math.pow(gameConfig.prices.prestige_scaling, data.total_fajerwerki);

        // --- LOGIKA KLIKANIA (NAPRAWIONA) ---
        if (interaction.customId === 'click_proch') {
            const baseGain = 1 + 
                (Number(data.zimne_ognie) * gameConfig.boosts.zimne_ognie) + 
                (Number(data.piccolo) * gameConfig.boosts.piccolo) + 
                (Number(data.szampan) * gameConfig.boosts.szampan_procenty) + 
                (Number(data.wyrzutnia) * gameConfig.boosts.wyrzutnia_pro);
            
            const totalGain = Math.floor(baseGain * curMult);
            
            db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(totalGain, userId);
            const fresh = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);

            const newFields = [
                { name: '✨ Proch:', value: `${formatNum(fresh.proch)}g`, inline: true },
                { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true },
                { name: '🎇 Fajerwerki:', value: `${fresh.fajerwerki_waluta}`, inline: true }
            ];
            
            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setFields(newFields);
            return interaction.update({ embeds: [updatedEmbed] });
        }

        // --- SKLEP I STRONY ---
        if (interaction.customId === 'open_shop' || interaction.customId.startsWith('shop_p')) {
            const page = interaction.customId === 'open_shop' ? 1 : parseInt(interaction.customId.replace('shop_p', ''));
            
            // Blokady fajerwerkowe
            if (page === 3 && data.fajerwerki_waluta < 10) return interaction.reply({ content: "❌ Musisz mieć min. 10 🎇, aby wejść na 3. stronę!", ephemeral: true });
            if (page === 4 && data.fajerwerki_waluta < 20) return interaction.reply({ content: "❌ Musisz mieć min. 20 🎇, aby wejść na 4. stronę!", ephemeral: true });

            const sEmbed = new EmbedBuilder().setTitle(`🛒 Sklep - Strona ${page}`).setColor('#2ECC71').setDescription(`Stan konta: **${formatNum(data.proch)}g** | 🎇: **${data.fajerwerki_waluta}**`);
            const row = new ActionRowBuilder();

            if (page === 1) {
                sEmbed.addFields(
                    { name: `🎇 Zimne (+${gameConfig.boosts.zimne_ognie})`, value: `${gameConfig.prices.zimne_ognie}g`, inline: true },
                    { name: `🚀 Wyrzutnia (+${gameConfig.boosts.wyrzutnia_pro})`, value: `${gameConfig.prices.wyrzutnia_pro}g`, inline: true }
                );
                row.addComponents(
                    new ButtonBuilder().setCustomId('buy_zimne').setLabel('Zimne').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_wyrzutnia').setLabel('Wyrzutnia').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('shop_p2').setLabel('➡️').setStyle(ButtonStyle.Primary)
                );
            } else if (page === 2) {
                sEmbed.addFields(
                    { name: `🐗 Dzik`, value: `Koszt: ${formatNum(gameConfig.prices.dzik_prices[0])}g`, inline: true },
                    { name: `🌵 BrawlPass`, value: `500k prochu`, inline: true }
                );
                row.addComponents(
                    new ButtonBuilder().setCustomId('shop_p1').setLabel('⬅️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('buy_dzik').setLabel('Kup Dzika').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('buy_brawlpass').setLabel('BrawlPass').setStyle(ButtonStyle.Warning),
                    new ButtonBuilder().setCustomId('shop_p3').setLabel('➡️').setStyle(ButtonStyle.Primary)
                );
            } else if (page === 3) {
                sEmbed.addFields({ name: '📦 PACZKA', value: `Koszt: ${gameConfig.prices.paczka_fajerwerek_cost} 🎇\n\n- Mega Boost x10\n- Resetuje postęp` });
                row.addComponents(
                    new ButtonBuilder().setCustomId('shop_p2').setLabel('⬅️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('buy_paczka').setLabel('ODPAL PACZKĘ 🎆').setStyle(ButtonStyle.Danger)
                );
            }

            return (interaction.customId === 'open_shop') ? interaction.reply({ embeds: [sEmbed], components: [row], ephemeral: true }) : interaction.update({ embeds: [sEmbed], components: [row] });
        }

        // --- OBSŁUGA ZAKUPÓW (NAPRAWIONA) ---
        if (interaction.customId === 'buy_zimne') {
            if (data.proch < gameConfig.prices.zimne_ognie) return interaction.reply({ content: "❌ Brak funduszy!", ephemeral: true });
            db.prepare('UPDATE players SET proch = proch - ?, zimne_ognie = zimne_ognie + 1 WHERE userId = ?').run(gameConfig.prices.zimne_ognie, userId);
            return interaction.reply({ content: "✅ Kupiono Zimne Ognie!", ephemeral: true });
        }

        if (interaction.customId === 'buy_wyrzutnia') {
            if (data.proch < gameConfig.prices.wyrzutnia_pro) return interaction.reply({ content: "❌ Brak funduszy!", ephemeral: true });
            db.prepare('UPDATE players SET proch = proch - ?, wyrzutnia = wyrzutnia + 1 WHERE userId = ?').run(gameConfig.prices.wyrzutnia_pro, userId);
            return interaction.reply({ content: "✅ Kupiono Wyrzutnię!", ephemeral: true });
        }

        if (interaction.customId === 'buy_brawlpass') {
            if (data.proch < 500000) return interaction.reply({ content: "❌ Brak 500k prochu!", ephemeral: true });
            db.prepare('UPDATE players SET proch = proch - 500000, multiplier = multiplier + 5 WHERE userId = ?').run(userId);
            return interaction.reply({ content: "🌵 BrawlPass kupiony! Mnożnik +5!", ephemeral: true });
        }

        // --- START GRY ---
        if (interaction.customId === 'start_game') {
            await interaction.deferReply({ ephemeral: true });
            const ch = await interaction.guild.channels.create({
                name: `sylwester-${interaction.user.username}`,
                parent: process.env.CATEGORY_ID,
                permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }],
            });
            const gEmbed = new EmbedBuilder().setTitle('🥂 Twój Magazyn').setImage(gameConfig.gfx.main_gif).setColor(gameConfig.gfx.color)
                .addFields({ name: '✨ Proch:', value: `${formatNum(data.proch)}g`, inline: true }, { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true }, { name: '🎇 Fajerwerki:', value: `${data.fajerwerki_waluta}`, inline: true });
            const btns = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('click_proch').setLabel('Zabierz Proch! 🧨').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('open_shop').setLabel('Sklep 🛒').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('firework_boom').setLabel(`ODPAL (${formatNum(nextPresPrice)})`).setStyle(ButtonStyle.Danger)
            );
            await ch.send({ embeds: [gEmbed], components: [btns] });
            return interaction.editReply({ content: `Kanał gotowy: ${ch}` });
        }
    }
};