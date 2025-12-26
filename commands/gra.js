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
        const embed = new EmbedBuilder()
            .setTitle('🎆 Sylwester 2025')
            .setDescription('Kliknij przycisk, aby stworzyć swój własny magazyn!')
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
            db.prepare('INSERT INTO players (userId, proch, multiplier, mega_multiplier, total_fajerwerki, fajerwerki_waluta, dzik, max_dzik, zimne_ognie, piccolo, szampan, wyrzutnia, pudelko) VALUES (?, 10000, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0)').run(userId);
            data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        }

        // --- MATEMATYKA ZYSKU ---
        const curMult = (Number(data.multiplier) + (Number(data.dzik) * gameConfig.boosts.dzik_val)) * Number(data.mega_multiplier);
        const nextPresPrice = gameConfig.prices.prestige_base * Math.pow(gameConfig.prices.prestige_scaling, data.total_fajerwerki);

        // --- KLIKANIE ---
        if (interaction.customId === 'click_proch') {
            const baseGain = 1 + 
                (Number(data.zimne_ognie) * gameConfig.boosts.zimne_ognie) + 
                (Number(data.piccolo) * gameConfig.boosts.piccolo) + 
                (Number(data.szampan) * gameConfig.boosts.szampan_procenty) + 
                (Number(data.wyrzutnia) * gameConfig.boosts.wyrzutnia_pro);
            
            const totalGain = Math.floor(baseGain * curMult);
            
            db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(totalGain, userId);
            const fresh = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);

            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setFields(
                { name: '✨ Proch:', value: `${formatNum(fresh.proch)}g`, inline: true },
                { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true },
                { name: '🎇 Fajerwerki:', value: `${fresh.fajerwerki_waluta}`, inline: true }
            );
            return interaction.update({ embeds: [updatedEmbed] });
        }

        // --- SKLEP I STRONY ---
        if (interaction.customId === 'open_shop' || interaction.customId.startsWith('shop_p')) {
            const page = interaction.customId === 'open_shop' ? 1 : parseInt(interaction.customId.replace('shop_p', ''));
            
            // Blokady stron
            if (page === 3 && data.fajerwerki_waluta < 10) return interaction.reply({ content: "❌ Wymagane 10 🎇!", ephemeral: true });
            if (page === 4 && data.fajerwerki_waluta < 20) return interaction.reply({ content: "❌ Wymagane 20 🎇!", ephemeral: true });

            const sEmbed = new EmbedBuilder().setTitle(`🛒 Sklep - Strona ${page}`).setColor('#2ECC71')
                .setDescription(`Twój Proch: **${formatNum(data.proch)}g** | 🎇: **${data.fajerwerki_waluta}**`);
            
            const row = new ActionRowBuilder();

            if (page === 1) {
                sEmbed.addFields(
                    { name: `🎇 Zimne (+${gameConfig.boosts.zimne_ognie})`, value: `${gameConfig.prices.zimne_ognie}g`, inline: true },
                    { name: `🍾 Piccolo (+${gameConfig.boosts.piccolo})`, value: `${gameConfig.prices.piccolo}g`, inline: true },
                    { name: `🥂 Szampan (+${gameConfig.boosts.szampan_procenty})`, value: `${gameConfig.prices.szampan_procenty}g`, inline: true },
                    { name: `🚀 Wyrzutnia (+${gameConfig.boosts.wyrzutnia_pro})`, value: `${gameConfig.prices.wyrzutnia_pro}g`, inline: true }
                );
                row.addComponents(
                    new ButtonBuilder().setCustomId('buy_zimne').setLabel('Zimne').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_piccolo').setLabel('Piccolo').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_szampan').setLabel('Szampan').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_wyrzutnia').setLabel('Wyrzutnia').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('shop_p2').setLabel('➡️').setStyle(ButtonStyle.Primary)
                );
            } else if (page === 2) {
                const dzikCost = gameConfig.prices.dzik_prices[data.dzik] || "MAX";
                sEmbed.addFields(
                    { name: `🐗 Dzik (+${gameConfig.boosts.dzik_val})`, value: `Koszt: ${formatNum(dzikCost)}g`, inline: true },
                    { name: `🌵 BrawlPass (+5 Multi)`, value: `Koszt: 500k prochu`, inline: true }
                );
                row.addComponents(
                    new ButtonBuilder().setCustomId('shop_p1').setLabel('⬅️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('buy_dzik').setLabel('Kup Dzika').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('buy_brawlpass').setLabel('BrawlPass').setStyle(ButtonStyle.Warning),
                    new ButtonBuilder().setCustomId('shop_p3').setLabel('➡️').setStyle(ButtonStyle.Primary)
                );
            } else if (page === 3) {
                sEmbed.addFields({ name: '📦 PACZKA FAJERWEREK', value: `Koszt: ${gameConfig.prices.paczka_fajerwerek_cost} 🎇\n\n- Mega Boost x10\n- Resetuje postęp (zostawia 🎇)` });
                row.addComponents(
                    new ButtonBuilder().setCustomId('shop_p2').setLabel('⬅️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('buy_paczka').setLabel('ODPAL PACZKĘ 🎆').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('shop_p4').setLabel('➡️').setStyle(ButtonStyle.Primary)
                );
            } else if (page === 4) {
                sEmbed.addFields({ name: '📦 Pudełko (Limit 1)', value: `Koszt: 5 🎇\nZwiększa sloty na Dziki!` });
                row.addComponents(
                    new ButtonBuilder().setCustomId('shop_p3').setLabel('⬅️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('buy_pudelko').setLabel('Kup Pudełko').setStyle(ButtonStyle.Success).setDisabled(data.pudelko >= 1)
                );
            }

            const payload = { embeds: [sEmbed], components: [row] };
            return interaction.customId === 'open_shop' ? interaction.reply({ ...payload, ephemeral: true }) : interaction.update(payload);
        }

        // --- OBSŁUGA ZAKUPÓW ---
        const handleBuy = (cost, col, amount = 1, currency = 'proch') => {
            if (data[currency] < cost) return interaction.reply({ content: `❌ Brak ${currency}!`, ephemeral: true });
            db.prepare(`UPDATE players SET ${currency} = ${currency} - ?, ${col} = ${col} + ? WHERE userId = ?`).run(cost, amount, userId);
            return interaction.reply({ content: `✅ Zakup udany!`, ephemeral: true });
        };

        if (interaction.customId === 'buy_zimne') return handleBuy(gameConfig.prices.zimne_ognie, 'zimne_ognie');
        if (interaction.customId === 'buy_piccolo') return handleBuy(gameConfig.prices.piccolo, 'piccolo');
        if (interaction.customId === 'buy_szampan') return handleBuy(gameConfig.prices.szampan_procenty, 'szampan');
        if (interaction.customId === 'buy_wyrzutnia') return handleBuy(gameConfig.prices.wyrzutnia_pro, 'wyrzutnia');
        
        if (interaction.customId === 'buy_brawlpass') return handleBuy(500000, 'multiplier', 5);
        if (interaction.customId === 'buy_pudelko') return handleBuy(5, 'pudelko', 1, 'fajerwerki_waluta');

        if (interaction.customId === 'buy_dzik') {
            const cost = gameConfig.prices.dzik_prices[data.dzik];
            if (!cost) return interaction.reply({ content: "❌ Masz już wszystkie dziki!", ephemeral: true });
            return handleBuy(cost, 'dzik');
        }

        if (interaction.customId === 'buy_paczka') {
            if (data.fajerwerki_waluta < gameConfig.prices.paczka_fajerwerek_cost) return interaction.reply({ content: "❌ Brak 🎇!", ephemeral: true });
            db.prepare(`UPDATE players SET proch=0, multiplier=1, zimne_ognie=0, piccolo=0, szampan=0, wyrzutnia=0, dzik=0, total_fajerwerki=0, fajerwerki_waluta=fajerwerki_waluta-?, mega_multiplier=10 WHERE userId=?`).run(gameConfig.prices.paczka_fajerwerek_cost, userId);
            return interaction.reply({ content: "🚀 PACZKA ODPALONA! Mnożnik x10 aktywny!", ephemeral: false });
        }

        // --- PRESTIŻ (ODPALANIE) ---
        if (interaction.customId === 'firework_boom') {
            if (data.proch < nextPresPrice) return interaction.reply({ content: `❌ Potrzebujesz ${formatNum(nextPresPrice)}g prochu!`, ephemeral: true });
            db.prepare(`UPDATE players SET proch=0, zimne_ognie=0, piccolo=0, szampan=0, wyrzutnia=0, dzik=0, total_fajerwerki=total_fajerwerki+1, fajerwerki_waluta=fajerwerki_waluta+1 WHERE userId=?`).run(userId);
            return interaction.reply({ content: "🎆 WIELKI WYSTRZAŁ! Zyskujesz 1 🎇", ephemeral: true });
        }

        // --- START ---
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

            await ch.send({ content: `Witaj ${interaction.user}!`, embeds: [gEmbed], components: [btns] });
            return interaction.editReply({ content: `Kanał: ${ch}` });
        }
    }
};