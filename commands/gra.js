const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../database.js');
const gameConfig = require('../config-gry.json');

// Funkcja formatująca liczby
const formatNum = (n) => {
    let num = Number(n);
    if (isNaN(num)) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return Math.floor(num).toString();
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gra')
        .setDescription('Rozpocznij przygodę i otwórz swój magazyn')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🎆 Sylwester 2025')
            .setDescription('Kliknij przycisk poniżej, aby stworzyć swój własny magazyn!')
            .setColor(gameConfig.gfx.color);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_game').setLabel('Zacznij Przygodę! 🧨').setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleInteraction(interaction) {
        const userId = interaction.user.id;
        let data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);

        if (!data) {
            db.prepare(`INSERT INTO players (userId, proch, multiplier, mega_multiplier, total_fajerwerki, fajerwerki_waluta, dzik, max_dzik, zimne_ognie, piccolo, szampan, wyrzutnia, pudelko, brawlpass_count) VALUES (?, 10000, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0)`).run(userId);
            data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        }

        // --- PRZELICZANIE MNOŻNIKA (POPRAWIONE) ---
        const prestigeMult = Math.pow(2, Number(data.total_fajerwerki)); 
        const bpBonus = Number(data.brawlpass_count) * 5; // Każdy BrawlPass to +5 do bazy
        const dzikBonus = Number(data.dzik) * gameConfig.boosts.dzik_val;
        
        // Finalny mnożnik: (Podstawa + BP + Dzik) * MegaMnożnik * Prestiż
        const curMult = (Number(data.multiplier) + bpBonus + dzikBonus) * Number(data.mega_multiplier) * prestigeMult;
        
        const getPrice = (count) => Number(gameConfig.prices.prestige_base) * Math.pow(Number(gameConfig.prices.prestige_scaling), count);
        const nextPresPrice = getPrice(data.total_fajerwerki);
        const currentBpPrice = gameConfig.prices.brawlpass_base * Math.pow(gameConfig.prices.brawlpass_scaling, data.brawlpass_count);

        // --- ZBIERANIE PROCHU ---
        if (interaction.customId === 'click_proch') {
            const itemsGain = (data.zimne_ognie * gameConfig.boosts.zimne_ognie) + 
                             (data.piccolo * gameConfig.boosts.piccolo) + 
                             (data.szampan * gameConfig.boosts.szampan_procenty) + 
                             (data.wyrzutnia * gameConfig.boosts.wyrzutnia_pro);
            
            const baseGain = 1 + itemsGain;
            const totalGain = Math.floor(baseGain * curMult);
            const newProchValue = data.proch + totalGain;
            
            db.prepare('UPDATE players SET proch = ? WHERE userId = ?').run(newProchValue, userId);
            
            const upEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setFields(
                { name: '✨ Proch:', value: `${formatNum(newProchValue)}g`, inline: true },
                { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true },
                { name: '🎇 Fajerwerki:', value: `${data.fajerwerki_waluta}`, inline: true }
            );

            const upBtns = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('click_proch').setLabel('Zabierz Proch! 🧨').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('open_shop').setLabel('Sklep 🛒').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('firework_boom').setLabel(`ODPAL (${formatNum(nextPresPrice)})`).setStyle(ButtonStyle.Danger)
            );

            return interaction.update({ embeds: [upEmbed], components: [upBtns] });
        }

        // --- SKLEP ---
        if (interaction.customId === 'open_shop' || interaction.customId.startsWith('shop_p')) {
            const page = interaction.customId === 'open_shop' ? 1 : parseInt(interaction.customId.replace('shop_p', ''));
            
            if (page === 2 && data.fajerwerki_waluta < 2) return interaction.reply({ content: "❌ Wymagane 2 🎇!", flags: [MessageFlags.Ephemeral] });
            if (page === 3 && data.fajerwerki_waluta < 10) return interaction.reply({ content: "❌ Wymagane 10 🎇!", flags: [MessageFlags.Ephemeral] });

            const sEmbed = new EmbedBuilder().setTitle(`🛒 Sklep - Strona ${page}`).setColor('#2ECC71')
                .setDescription(`Proch: **${formatNum(data.proch)}g** | 🎇: **${data.fajerwerki_waluta}**`);
            
            const rows = [new ActionRowBuilder(), new ActionRowBuilder()];

            if (page === 1) {
                sEmbed.addFields(
                    { name: `🎇 Zimne (+${gameConfig.boosts.zimne_ognie}g)`, value: `**${gameConfig.prices.zimne_ognie}g**`, inline: true },
                    { name: `🍾 Piccolo (+${gameConfig.boosts.piccolo}g)`, value: `**${gameConfig.prices.piccolo}g**`, inline: true },
                    { name: `🥂 Szampan (+${gameConfig.boosts.szampan_procenty}g)`, value: `**${gameConfig.prices.szampan_procenty}g**`, inline: true },
                    { name: `🚀 Wyrzutnia (+${gameConfig.boosts.wyrzutnia_pro}g)`, value: `**${gameConfig.prices.wyrzutnia_pro}g**`, inline: true }
                );
                rows[0].addComponents(
                    new ButtonBuilder().setCustomId('buy_zimne').setLabel('Zimne').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_piccolo').setLabel('Piccolo').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_szampan').setLabel('Szampan').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_wyrzutnia').setLabel('Wyrzutnia').setStyle(ButtonStyle.Secondary)
                );
                rows[1].addComponents(new ButtonBuilder().setCustomId('shop_p2').setLabel('Strona 2 (2🎇) ➡️').setStyle(ButtonStyle.Primary));
            } else if (page === 2) {
                const dzikCost = gameConfig.prices.dzik_prices[data.dzik] || "MAX";
                sEmbed.addFields(
                    { name: `🐗 Dzik (+${gameConfig.boosts.dzik_val}x)`, value: `**${formatNum(dzikCost)}g**`, inline: true },
                    { name: `🌵 BrawlPass (+5 Multi)`, value: `**${formatNum(currentBpPrice)}g**`, inline: true }
                );
                rows[0].addComponents(
                    new ButtonBuilder().setCustomId('buy_dzik').setLabel('Dzik').setStyle(ButtonStyle.Success).setDisabled(dzikCost === "MAX"),
                    new ButtonBuilder().setCustomId('buy_brawlpass').setLabel('BrawlPass').setStyle(ButtonStyle.Danger).setDisabled(data.brawlpass_count >= gameConfig.boosts.brawlpass_limit)
                );
                rows[1].addComponents(
                    new ButtonBuilder().setCustomId('shop_p1').setLabel('⬅️ Strona 1').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('shop_p3').setLabel('Strona 3 (10🎇) ➡️').setStyle(ButtonStyle.Primary)
                );
            } else if (page === 3) {
                sEmbed.addFields({ name: '📦 PACZKA SYLWESTROWA', value: `Koszt: **${gameConfig.prices.paczka_fajerwerek_cost} 🎇**\n\nBonus: Mega Boost x10!` });
                rows[0].addComponents(new ButtonBuilder().setCustomId('buy_paczka').setLabel('ODPAL PACZKĘ 🎆').setStyle(ButtonStyle.Danger));
                rows[1].addComponents(new ButtonBuilder().setCustomId('shop_p2').setLabel('⬅️ Strona 2').setStyle(ButtonStyle.Primary));
            }

            return interaction.customId === 'open_shop' ? interaction.reply({ embeds: [sEmbed], components: rows, flags: [MessageFlags.Ephemeral] }) : interaction.update({ embeds: [sEmbed], components: rows });
        }

        // --- ZAKUPY ---
        if (interaction.customId.startsWith('buy_')) {
            const item = interaction.customId.replace('buy_', '');
            
            if (item === 'paczka') {
                if (data.fajerwerki_waluta < gameConfig.prices.paczka_fajerwerek_cost) return interaction.reply({ content: "❌ Brak 🎇!", flags: [MessageFlags.Ephemeral] });
                db.prepare('UPDATE players SET proch=0, multiplier=1, zimne_ognie=0, piccolo=0, szampan=0, wyrzutnia=0, dzik=0, total_fajerwerki=0, fajerwerki_waluta=fajerwerki_waluta-?, mega_multiplier=mega_multiplier*10 WHERE userId=?').run(gameConfig.prices.paczka_fajerwerek_cost, userId);
                return interaction.reply({ content: "💥 **Aktywowanie wybuchu wielkiej paczki!** 💥", flags: [MessageFlags.Ephemeral] });
            }

            let cost = 0;
            let col = item === 'zimne' ? 'zimne_ognie' : item;

            if (item === 'brawlpass') {
                if (data.brawlpass_count >= gameConfig.boosts.brawlpass_limit) return interaction.reply({ content: "❌ Limit BP!", flags: [MessageFlags.Ephemeral] });
                cost = currentBpPrice;
            } else if (item === 'dzik') {
                cost = gameConfig.prices.dzik_prices[data.dzik];
            } else {
                cost = gameConfig.prices[item === 'zimne' ? 'zimne_ognie' : item === 'szampan' ? 'szampan_procenty' : item === 'wyrzutnia' ? 'wyrzutnia_pro' : item];
            }

            if (data.proch < cost) return interaction.reply({ content: "❌ Brak prochu!", flags: [MessageFlags.Ephemeral] });

            if (item === 'brawlpass') {
                db.prepare('UPDATE players SET proch = proch - ?, multiplier = multiplier + 5, brawlpass_count = brawlpass_count + 1 WHERE userId = ?').run(cost, userId);
            } else {
                db.prepare(`UPDATE players SET proch = proch - ?, ${col} = ${col} + 1 WHERE userId = ?`).run(cost, userId);
            }
            return interaction.reply({ content: `✅ Zakupiono ${item}!`, flags: [MessageFlags.Ephemeral] });
        }

        // --- ODPALANIE ---
        if (interaction.customId === 'firework_boom') {
            if (data.proch < nextPresPrice) return interaction.reply({ content: `❌ Brak prochu!`, flags: [MessageFlags.Ephemeral] });
            db.prepare('UPDATE players SET proch=0, zimne_ognie=0, piccolo=0, szampan=0, wyrzutnia=0, dzik=0, total_fajerwerki=total_fajerwerki+1, fajerwerki_waluta=fajerwerki_waluta+1 WHERE userId=?').run(userId);
            return interaction.reply({ content: "🎆 Wybuchło! Mnożnik x2 aktywny!", flags: [MessageFlags.Ephemeral] });
        }

        // --- START GRY ---
        if (interaction.customId === 'start_game') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const ch = await interaction.guild.channels.create({
                name: `sylwester-${interaction.user.username}`,
                parent: process.env.CATEGORY_ID || null,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ],
            });

            const gEmbed = new EmbedBuilder().setTitle('🥂 Twój Magazyn').setImage(gameConfig.gfx.main_gif).setColor(gameConfig.gfx.color)
                .addFields({ name: '✨ Proch:', value: `${formatNum(data.proch)}g`, inline: true }, { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true }, { name: '🎇 Fajerwerki:', value: `${data.fajerwerki_waluta}`, inline: true });

            const btns = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('click_proch').setLabel('Zabierz Proch! 🧨').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('open_shop').setLabel('Sklep 🛒').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('firework_boom').setLabel(`ODPAL (${formatNum(nextPresPrice)})`).setStyle(ButtonStyle.Danger)
            );

            await ch.send({ embeds: [gEmbed], components: [btns] });
            return interaction.editReply({ content: `Magazyn: ${ch}` });
        }
    }
};