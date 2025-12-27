const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../database.js');
const gameConfig = require('../config-gry.json');

const formatNum = (n) => {
    let num = Number(n);
    if (isNaN(num)) return "0g";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'kg';
    return Math.floor(num).toString() + 'g';
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gra')
        .setDescription('Otwórz swój magazyn fajerwerków')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🎆 Sylwester 2025')
            .setDescription('Kliknij przycisk poniżej, aby stworzyć swój magazyn!')
            .setColor(gameConfig.gfx.color);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_game').setLabel('Zacznij Przygodę! 🧨').setStyle(ButtonStyle.Danger)
        );
        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleInteraction(interaction) {
        try {
            const userId = interaction.user.id;
            let data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);

            if (!data) {
                db.prepare(`INSERT INTO players (userId, proch, multiplier, mega_multiplier, total_fajerwerki, fajerwerki_waluta, dzik, max_dzik, zimne_ognie, piccolo, szampan, wyrzutnia, pudelko, brawlpass_count) VALUES (?, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0)`).run(userId);
                data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
            }

            if (data.dzik > 5) {
                db.prepare('UPDATE players SET dzik = 5 WHERE userId = ?').run(userId);
                data.dzik = 5; 
            }

            const prestigeMult = Math.pow(2, data.total_fajerwerki); 
            const curMult = (data.multiplier + (data.brawlpass_count * 5) + (data.dzik * gameConfig.boosts.dzik_val)) * data.mega_multiplier * prestigeMult;
            const nextPresPrice = gameConfig.prices.prestige_base * Math.pow(gameConfig.prices.prestige_scaling, data.total_fajerwerki);
            const currentBpPrice = gameConfig.prices.brawlpass_base * Math.pow(gameConfig.prices.brawlpass_scaling, data.brawlpass_count);

            if (interaction.customId === 'back_to_main') {
                const mainEmbed = new EmbedBuilder()
                    .setTitle('🥂 Twój Magazyn')
                    .setImage(gameConfig.gfx.main_gif)
                    .setColor(gameConfig.gfx.color)
                    .addFields(
                        { name: '✨ Proch:', value: `${formatNum(data.proch)}`, inline: true },
                        { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true },
                        { name: '🎇 Fajerwerki:', value: `${data.fajerwerki_waluta}`, inline: true }
                    );
                const mainBtns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('click_proch').setLabel('Zabierz Proch! 🧨').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('open_shop').setLabel('Sklep 🛒').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('firework_boom').setLabel(`ODPAL (${formatNum(nextPresPrice)})`).setStyle(ButtonStyle.Danger)
                );
                return await interaction.update({ embeds: [mainEmbed], components: [mainBtns] });
            }

            if (interaction.customId === 'click_proch') {
                const itemsGain = (data.zimne_ognie * gameConfig.boosts.zimne_ognie) + (data.piccolo * gameConfig.boosts.piccolo) + (data.szampan * gameConfig.boosts.szampan_procenty) + (data.wyrzutnia * gameConfig.boosts.wyrzutnia_pro);
                const totalGain = Math.floor((1 + itemsGain) * curMult);
                db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(totalGain, userId);
                const newData = data.proch + totalGain;
                const upEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setFields(
                    { name: '✨ Proch:', value: `${formatNum(newData)}`, inline: true },
                    { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true },
                    { name: '🎇 Fajerwerki:', value: `${data.fajerwerki_waluta}`, inline: true }
                );
                const upRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('click_proch').setLabel('Zabierz Proch! 🧨').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('open_shop').setLabel('Sklep 🛒').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('firework_boom').setLabel(`ODPAL (${formatNum(nextPresPrice)})`).setStyle(ButtonStyle.Danger)
                );
                return await interaction.update({ embeds: [upEmbed], components: [upRow] });
            }

            if (interaction.customId === 'open_shop' || interaction.customId.startsWith('shop_p')) {
                let page = 1;
                if (interaction.customId.startsWith('shop_p')) {
                    page = parseInt(interaction.customId.replace('shop_p', '')) || 1;
                }
                const sEmbed = new EmbedBuilder()
                    .setTitle(`🛒 Sklep - Strona ${page}`)
                    .setColor('#2ECC71')
                    .setDescription(`Proch: **${formatNum(data.proch)}** | Waluta 🎇: **${data.fajerwerki_waluta}**`);
                const rows = [];
                const row1 = new ActionRowBuilder();
                const row2 = new ActionRowBuilder();
                if (page === 1) {
                    sEmbed.addFields(
                        { name: '🎇 Zimne (+1)', value: `${gameConfig.prices.zimne_ognie}g`, inline: true },
                        { name: '🍾 Piccolo (+10)', value: `${gameConfig.prices.piccolo}g`, inline: true },
                        { name: '🥂 Szampan (+50)', value: `${gameConfig.prices.szampan_procenty}g`, inline: true },
                        { name: '🚀 Wyrzutnia (+200)', value: `${gameConfig.prices.wyrzutnia_pro}g`, inline: true }
                    );
                    row1.addComponents(
                        new ButtonBuilder().setCustomId('buy_zimne').setLabel('Zimne').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('buy_piccolo').setLabel('Piccolo').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('buy_szampan').setLabel('Szampan').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('buy_wyrzutnia').setLabel('Wyrzutnia').setStyle(ButtonStyle.Secondary)
                    );
                    row2.addComponents(
                        new ButtonBuilder().setCustomId('back_to_main').setLabel('🏠 Powrót').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('shop_p2').setLabel('Strona 2 ➡️').setStyle(ButtonStyle.Primary)
                    );
                } else if (page === 2) {
                    const dzikCost = gameConfig.prices.dzik_prices[data.dzik] || "MAX";
                    sEmbed.addFields(
                        { name: `🐗 Dzik (${data.dzik}/5) (*1.5)`, value: `${dzikCost === "MAX" ? "MAX" : formatNum(dzikCost)}`, inline: true }, 
                        { name: `🌵 BP (${data.brawlpass_count}/${gameConfig.boosts.brawlpass_limit}) (*5)`, value: `${formatNum(currentBpPrice)}`, inline: true }
                    );
                    row1.addComponents(
                        new ButtonBuilder().setCustomId('buy_dzik').setLabel('Dzik').setStyle(ButtonStyle.Success).setDisabled(dzikCost === "MAX" || data.dzik >= 5),
                        new ButtonBuilder().setCustomId('buy_brawlpass').setLabel('BrawlPass').setStyle(ButtonStyle.Danger).setDisabled(data.brawlpass_count >= gameConfig.boosts.brawlpass_limit)
                    );
                    row2.addComponents(
                        new ButtonBuilder().setCustomId('shop_p1').setLabel('⬅️ Strona 1').setStyle(ButtonStyle.Primary), 
                        new ButtonBuilder().setCustomId('shop_p3').setLabel('Strona 3 ➡️').setStyle(ButtonStyle.Primary)
                    );
                } else if (page === 3) {
                    const hasPaczka = data.mega_multiplier > 1;
                    sEmbed.addFields({ name: '📦 WIELKA PACZKA', value: hasPaczka ? "✅ ZAKUPIONO" : `Koszt: ${gameConfig.prices.paczka_fajerwerek_cost} 🎇\nRESETUJE WSZYSTKO` });
                    row1.addComponents(
                        new ButtonBuilder().setCustomId('buy_paczka').setLabel(hasPaczka ? 'WYKORZYSTANO' : 'ODPAL PACZKĘ 🎆').setStyle(ButtonStyle.Danger).setDisabled(hasPaczka)
                    );
                    row2.addComponents(
                        new ButtonBuilder().setCustomId('shop_p2').setLabel('⬅️ Strona 2').setStyle(ButtonStyle.Primary)
                    );
                }
                rows.push(row1, row2);
                return await interaction.update({ embeds: [sEmbed], components: rows });
            }

            if (interaction.customId === 'start_game') {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                const ch = await interaction.guild.channels.create({
                    name: `magazyn-${interaction.user.username}`,
                    parent: process.env.CATEGORY_ID || null,
                    permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }],
                });
                const gEmbed = new EmbedBuilder().setTitle('🥂 Twój Magazyn').setImage(gameConfig.gfx.main_gif).setColor(gameConfig.gfx.color)
                    .addFields({ name: '✨ Proch:', value: `${formatNum(data.proch)}`, inline: true }, { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true }, { name: '🎇 Fajerwerki:', value: `${data.fajerwerki_waluta}`, inline: true });
                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('click_proch').setLabel('Zabierz Proch! 🧨').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('open_shop').setLabel('Sklep 🛒').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('firework_boom').setLabel(`ODPAL (${formatNum(nextPresPrice)})`).setStyle(ButtonStyle.Danger)
                );
                await ch.send({ content: `<@${userId}>`, embeds: [gEmbed], components: [btns] });
                return await interaction.editReply({ content: `✅ Magazyn stworzony: ${ch}` });
            }

            if (interaction.customId.startsWith('buy_')) {
                const item = interaction.customId.replace('buy_', '');
                if (item === 'paczka') {
                    if (data.mega_multiplier > 1) return await interaction.reply({ content: "❌ Już wykorzystano!", flags: [MessageFlags.Ephemeral] });
                    if (data.fajerwerki_waluta < gameConfig.prices.paczka_fajerwerek_cost) return await interaction.reply({ content: "❌ Brak 🎇!", flags: [MessageFlags.Ephemeral] });
                    db.prepare(`UPDATE players SET proch=0, multiplier=1, zimne_ognie=0, piccolo=0, szampan=0, wyrzutnia=0, dzik=0, brawlpass_count=0, total_fajerwerki=0, fajerwerki_waluta=0, mega_multiplier=10 WHERE userId=?`).run(userId);
                    return await interaction.reply({ content: "💥 TOTALNY RESET!", flags: [MessageFlags.Ephemeral] });
                }
                let cost = 0, dbCol = "";
                if (item === 'dzik') {
                    if (data.dzik >= 5) return await interaction.reply({ content: "❌ Limit osiągnięty!", flags: [MessageFlags.Ephemeral] });
                    cost = gameConfig.prices.dzik_prices[data.dzik]; 
                    dbCol = 'dzik';
                } else if (item === 'brawlpass') {
                    cost = currentBpPrice; 
                    dbCol = 'brawlpass_count';
                } else {
                    const pMap = { zimne: 'zimne_ognie', piccolo: 'piccolo', szampan: 'szampan_procenty', wyrzutnia: 'wyrzutnia_pro' };
                    const dMap = { zimne: 'zimne_ognie', piccolo: 'piccolo', szampan: 'szampan', wyrzutnia: 'wyrzutnia' };
                    cost = gameConfig.prices[pMap[item]]; 
                    dbCol = dMap[item];
                }
                if (data.proch < cost) return await interaction.reply({ content: "❌ Brak prochu!", flags: [MessageFlags.Ephemeral] });
                db.prepare(`UPDATE players SET proch = proch - ?, ${dbCol} = ${dbCol} + 1 WHERE userId = ?`).run(cost, userId);
                const currentPage = interaction.message.embeds[0].title.includes('Strona 2') ? 2 : (interaction.message.embeds[0].title.includes('Strona 3') ? 3 : 1);
                interaction.customId = `shop_p${currentPage}`;
                return await this.handleInteraction(interaction);
            }

            if (interaction.customId === 'firework_boom') {
                if (data.proch < nextPresPrice) return await interaction.reply({ content: `❌ Wymagane: ${formatNum(nextPresPrice)}`, flags: [MessageFlags.Ephemeral] });
                db.prepare('UPDATE players SET proch=0, zimne_ognie=0, piccolo=0, szampan=0, wyrzutnia=0, dzik=0, brawlpass_count=0, total_fajerwerki=total_fajerwerki+1, fajerwerki_waluta=fajerwerki_waluta+1 WHERE userId=?').run(userId);
                const freshData = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
                const freshPresMult = Math.pow(2, freshData.total_fajerwerki);
                const freshTotalMult = (freshData.multiplier + (freshData.brawlpass_count * 5) + (freshData.dzik * gameConfig.boosts.dzik_val)) * freshData.mega_multiplier * freshPresMult;
                const freshNextPrice = gameConfig.prices.prestige_base * Math.pow(gameConfig.prices.prestige_scaling, freshData.total_fajerwerki);
                const presEmbed = new EmbedBuilder()
                    .setTitle('🥂 Twój Magazyn')
                    .setImage(gameConfig.gfx.main_gif)
                    .setColor(gameConfig.gfx.color)
                    .setFields(
                        { name: '✨ Proch:', value: `0g`, inline: true }, 
                        { name: '🚀 Mnożnik:', value: `x${freshTotalMult.toFixed(1)}`, inline: true }, 
                        { name: '🎇 Fajerwerki:', value: `${freshData.fajerwerki_waluta}`, inline: true }
                    );
                const presRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('click_proch').setLabel('Zabierz Proch! 🧨').setStyle(ButtonStyle.Success), 
                    new ButtonBuilder().setCustomId('open_shop').setLabel('Sklep 🛒').setStyle(ButtonStyle.Primary), 
                    new ButtonBuilder().setCustomId('firework_boom').setLabel(`ODPAL (${formatNum(freshNextPrice)})`).setStyle(ButtonStyle.Danger)
                );
                return await interaction.update({ embeds: [presEmbed], components: [presRow] });
            }

        } catch (err) {
            console.error("Błąd:", err);
        }
    }
};