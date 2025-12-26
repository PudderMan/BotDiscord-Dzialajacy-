const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../database.js');
const gameConfig = require('../config-gry.json');

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

        // --- PRZELICZANIE MNOŻNIKA ---
        const prestigeMult = Math.pow(2, Number(data.total_fajerwerki)); 
        const bpBonus = Number(data.brawlpass_count) * 5; 
        const dzikBonus = Number(data.dzik) * gameConfig.boosts.dzik_val;
        
        // Finalny mnożnik: (Baza + BP + Dzik) * MegaMnożnik * Prestiż
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
            
            const totalGain = Math.floor((1 + itemsGain) * curMult);
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
            const sEmbed = new EmbedBuilder().setTitle(`🛒 Sklep - Str. ${page}`).setColor('#2ECC71').setDescription(`Proch: **${formatNum(data.proch)}g**`);
            const rows = [new ActionRowBuilder(), new ActionRowBuilder()];

            if (page === 1) {
                rows[0].addComponents(
                    new ButtonBuilder().setCustomId('buy_zimne').setLabel('Zimne').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_piccolo').setLabel('Piccolo').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_szampan').setLabel('Szampan').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_wyrzutnia').setLabel('Wyrzutnia').setStyle(ButtonStyle.Secondary)
                );
                rows[1].addComponents(new ButtonBuilder().setCustomId('shop_p2').setLabel('Następna ➡️').setStyle(ButtonStyle.Primary));
            } else if (page === 2) {
                const dzikCost = gameConfig.prices.dzik_prices[data.dzik] || "MAX";
                rows[0].addComponents(
                    new ButtonBuilder().setCustomId('buy_dzik').setLabel(`Dzik (${data.dzik}/${gameConfig.boosts.dzik_limit || 5})`).setStyle(ButtonStyle.Success).setDisabled(dzikCost === "MAX"),
                    new ButtonBuilder().setCustomId('buy_brawlpass').setLabel(`BrawlPass (${data.brawlpass_count}/${gameConfig.boosts.brawlpass_limit})`).setStyle(ButtonStyle.Danger).setDisabled(data.brawlpass_count >= gameConfig.boosts.brawlpass_limit)
                );
                rows[1].addComponents(new ButtonBuilder().setCustomId('shop_p1').setLabel('⬅️ Poprzednia').setStyle(ButtonStyle.Primary));
            }
            return interaction.reply({ embeds: [sEmbed], components: rows, flags: [MessageFlags.Ephemeral] });
        }

        // --- ZAKUPY ---
        if (interaction.customId.startsWith('buy_')) {
            const item = interaction.customId.replace('buy_', '');
            let cost = 0;

            if (item === 'brawlpass') {
                if (data.brawlpass_count >= gameConfig.boosts.brawlpass_limit) return interaction.reply({ content: "❌ Osiągnąłeś limit BrawlPass na ten prestiż!", flags: [MessageFlags.Ephemeral] });
                cost = currentBpPrice;
                db.prepare('UPDATE players SET proch = proch - ?, brawlpass_count = brawlpass_count + 1 WHERE userId = ?').run(cost, userId);
            } else if (item === 'dzik') {
                cost = gameConfig.prices.dzik_prices[data.dzik];
                if (!cost) return interaction.reply({ content: "❌ Osiągnąłeś limit Dzików!", flags: [MessageFlags.Ephemeral] });
                db.prepare('UPDATE players SET proch = proch - ?, dzik = dzik + 1 WHERE userId = ?').run(cost, userId);
            } else {
                const col = item === 'zimne' ? 'zimne_ognie' : item;
                cost = gameConfig.prices[item === 'zimne' ? 'zimne_ognie' : item === 'szampan' ? 'szampan_procenty' : item === 'wyrzutnia' ? 'wyrzutnia_pro' : item];
                db.prepare(`UPDATE players SET proch = proch - ?, ${col} = ${col} + 1 WHERE userId = ?`).run(cost, userId);
            }

            if (data.proch < cost) return interaction.reply({ content: "❌ Za mało prochu!", flags: [MessageFlags.Ephemeral] });
            return interaction.reply({ content: `✅ Zakupiono ${item}!`, flags: [MessageFlags.Ephemeral] });
        }

        // --- ODPALANIE (RESET BRAWLPASSA I DZIKA) ---
        if (interaction.customId === 'firework_boom') {
            if (data.proch < nextPresPrice) return interaction.reply({ content: `❌ Potrzebujesz ${formatNum(nextPresPrice)}g prochu!`, flags: [MessageFlags.Ephemeral] });
            
            // RESETUJEMY: Proch, ulepszenia, Dziki oraz BrawlPassy. Zwiększamy Prestiż i Walutę 🎇.
            db.prepare(`
                UPDATE players SET 
                proch = 0, 
                zimne_ognie = 0, 
                piccolo = 0, 
                szampan = 0, 
                wyrzutnia = 0, 
                dzik = 0, 
                brawlpass_count = 0, 
                total_fajerwerki = total_fajerwerki + 1, 
                fajerwerki_waluta = fajerwerki_waluta + 1 
                WHERE userId = ?
            `).run(userId);

            return interaction.reply({ content: "🎆 **WIELKI WYBUCH!** Twój magazyn został zresetowany, ale mnożnik Prestiżu wzrósł o x2! BrawlPass i Dziki są gotowe do ponownego zakupu.", flags: [MessageFlags.Ephemeral] });
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
            return interaction.editReply({ content: `Otwarto magazyn: ${ch}` });
        }
    }
};