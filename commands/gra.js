const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../database.js');
const gameConfig = require('../config-gry.json');

// --- ROZSZERZONE FORMATOWANIE ---

const formatProch = (n) => {
    let num = Number(n);
    if (isNaN(num)) return "0g";
    if (num >= 1e27) return (num / 1e27).toFixed(2) + 'O'; // Oktyliony
    if (num >= 1e24) return (num / 1e24).toFixed(2) + 'S'; // Septyliony
    if (num >= 1e21) return (num / 1e21).toFixed(2) + 's'; // Sekstyliony
    if (num >= 1e18) return (num / 1e18).toFixed(2) + 'Q'; // Kwintyliony
    if (num >= 1e15) return (num / 1e15).toFixed(2) + 'k'; // Kwadryliony
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 't'; // Biliony
    if (num >= 1e9)  return (num / 1e9).toFixed(2) + 'b';  // Miliardy
    if (num >= 1e6)  return (num / 1e6).toFixed(1) + 'M';  // Miliony
    if (num >= 1000) return (num / 1000).toFixed(1) + 'kg';
    return Math.floor(num).toString() + 'g';
};

const formatMult = (n) => {
    let num = Number(n);
    if (isNaN(num)) return "x1.0";
    let p = "x";
    if (num >= 1e27) return p + (num / 1e27).toFixed(2) + 'O';
    if (num >= 1e24) return p + (num / 1e24).toFixed(2) + 'S';
    if (num >= 1e21) return p + (num / 1e21).toFixed(2) + 's';
    if (num >= 1e18) return p + (num / 1e18).toFixed(2) + 'Q';
    if (num >= 1e15) return p + (num / 1e15).toFixed(2) + 'k';
    if (num >= 1e12) return p + (num / 1e12).toFixed(2) + 't';
    if (num >= 1e9)  return p + (num / 1e9).toFixed(2) + 'b';
    if (num >= 1e6)  return p + (num / 1e6).toFixed(1) + 'M';
    return p + num.toFixed(1);
};

// --- KOMENDA I OBSŁUGA ---

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gra')
        .setDescription('Zarządzaj swoim magazynem')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🎆 Sylwester 2025')
            .setDescription('Kliknij przycisk, aby wejść do magazynu!')
            .setColor(gameConfig.gfx.color);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_game').setLabel('Otwórz Magazyn 🧨').setStyle(ButtonStyle.Danger)
        );
        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleInteraction(interaction) {
        try {
            const userId = interaction.user.id;
            
            // Zabezpieczenie przed Unknown Interaction i podwójnym Defer
            if (interaction.customId !== 'start_game' && !interaction.deferred) {
                await interaction.deferUpdate();
            }

            let data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
            if (!data) {
                db.prepare(`INSERT INTO players (userId, proch, multiplier, mega_multiplier, total_fajerwerki, fajerwerki_waluta, dzik, max_dzik, zimne_ognie, piccolo, szampan, wyrzutnia, pudelko, brawlpass_count) VALUES (?, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0)`).run(userId);
                data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
            }

            const prestigeMult = Math.pow(2, data.total_fajerwerki);
            const curMult = (data.multiplier + (data.brawlpass_count * 5) + (data.dzik * gameConfig.boosts.dzik_val)) * data.mega_multiplier * prestigeMult;
            const nextPresPrice = gameConfig.prices.prestige_base * Math.pow(gameConfig.prices.prestige_scaling, data.total_fajerwerki);

            // --- LOGIKA ZAKUPÓW ---
            if (interaction.customId.startsWith('buy_')) {
                const item = interaction.customId.replace('buy_', '');
                let cost = 0, dbCol = "", bonusVal = 0;
                const currentBpPrice = gameConfig.prices.brawlpass_base * Math.pow(gameConfig.prices.brawlpass_scaling, data.brawlpass_count);

                if (item === 'ulps1') { cost = 10000000; bonusVal = 500000; dbCol = 'multiplier'; }
                else if (item === 'ulps2') { cost = 100000000; bonusVal = 5000000; dbCol = 'multiplier'; }
                else if (item === 'dzik') { cost = gameConfig.prices.dzik_prices[data.dzik] || 0; dbCol = 'dzik'; bonusVal = 1; }
                else if (item === 'brawlpass') { if (data.brawlpass_count < 2) { cost = currentBpPrice; dbCol = 'brawlpass_count'; bonusVal = 1; } }
                else if (item === 'paczka') {
                    if (data.fajerwerki_waluta >= gameConfig.prices.paczka_fajerwerek_cost && data.mega_multiplier === 1) {
                        db.prepare('UPDATE players SET mega_multiplier = 10, fajerwerki_waluta = fajerwerki_waluta - ? WHERE userId = ?').run(gameConfig.prices.paczka_fajerwerek_cost, userId);
                    }
                } else {
                    const pMap = { zimne: 'zimne_ognie', piccolo: 'piccolo', szampan: 'szampan_procenty', wyrzutnia: 'wyrzutnia_pro' };
                    const dMap = { zimne: 'zimne_ognie', piccolo: 'piccolo', szampan: 'szampan', wyrzutnia: 'wyrzutnia' };
                    cost = gameConfig.prices[pMap[item]] || 0; dbCol = dMap[item]; bonusVal = 1;
                }

                if (cost > 0 && data.proch >= cost && dbCol !== "") {
                    db.prepare(`UPDATE players SET proch = proch - ?, ${dbCol} = ${dbCol} + ? WHERE userId = ?`).run(cost, bonusVal, userId);
                }
                // Odświeżamy obiekt danych po zakupie
                data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
            }

            // --- WIDOKI (SKLEP / MAGAZYN) ---
            
            // Strony sklepu
            if (interaction.customId === 'open_shop' || interaction.customId.startsWith('shop_p') || interaction.customId.startsWith('buy_')) {
                let page = 1;
                if (interaction.customId.startsWith('shop_p')) page = parseInt(interaction.customId.replace('shop_p', ''));
                else if (interaction.message.embeds[0]?.title.includes('Strona')) {
                    page = parseInt(interaction.message.embeds[0].title.split(' ').pop()) || 1;
                }

                const sEmbed = new EmbedBuilder().setTitle(`🛒 Sklep - Strona ${page}`).setColor('#2ECC71').setDescription(`Twój Proch: **${formatProch(data.proch)}**`);
                const r1 = new ActionRowBuilder(); const r2 = new ActionRowBuilder();

                if (page === 1) {
                    sEmbed.addFields({ name: '🎇 Zimne', value: `${gameConfig.prices.zimne_ognie}g`, inline: true }, { name: '🍾 Piccolo', value: `${gameConfig.prices.piccolo}g`, inline: true }, { name: '🥂 Szampan', value: `${gameConfig.prices.szampan_procenty}g`, inline: true }, { name: '🚀 Wyrzutnia', value: `${gameConfig.prices.wyrzutnia_pro}g`, inline: true });
                    r1.addComponents(new ButtonBuilder().setCustomId('buy_zimne').setLabel('Zimne').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('buy_piccolo').setLabel('Piccolo').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('buy_szampan').setLabel('Szampan').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('buy_wyrzutnia').setLabel('Wyrzutnia').setStyle(ButtonStyle.Secondary));
                    r2.addComponents(new ButtonBuilder().setCustomId('back_to_main').setLabel('🏠 Powrót').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('shop_p2').setLabel('Strona 2 ➡️').setStyle(ButtonStyle.Primary));
                } else if (page === 2) {
                    const dzikCost = gameConfig.prices.dzik_prices[data.dzik] || "MAX";
                    const currentBpPrice = gameConfig.prices.brawlpass_base * Math.pow(gameConfig.prices.brawlpass_scaling, data.brawlpass_count);
                    sEmbed.addFields({ name: `🐗 Dzik (${data.dzik}/5)`, value: `${dzikCost === "MAX" ? "MAX" : formatProch(dzikCost)}`, inline: true }, { name: `🌵 BP (${data.brawlpass_count}/2)`, value: `${formatProch(currentBpPrice)}`, inline: true });
                    r1.addComponents(new ButtonBuilder().setCustomId('buy_dzik').setLabel('Dzik').setStyle(ButtonStyle.Success).setDisabled(dzikCost === "MAX"), new ButtonBuilder().setCustomId('buy_brawlpass').setLabel('BrawlPass').setStyle(ButtonStyle.Danger).setDisabled(data.brawlpass_count >= 2));
                    r2.addComponents(new ButtonBuilder().setCustomId('shop_p1').setLabel('⬅️ Strona 1').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('shop_p3').setLabel('Strona 3 ➡️').setStyle(ButtonStyle.Primary));
                } else if (page === 3) {
                    const hasPaczka = data.mega_multiplier > 1;
                    sEmbed.addFields({ name: '📦 WIELKA PACZKA', value: hasPaczka ? "✅ ZAKUPIONO" : `Koszt: ${gameConfig.prices.paczka_fajerwerek_cost} 🎇\nZwiększa zarobki x10.` });
                    r1.addComponents(new ButtonBuilder().setCustomId('buy_paczka').setLabel('Kup Paczkę').setStyle(ButtonStyle.Danger).setDisabled(hasPaczka));
                    r2.addComponents(new ButtonBuilder().setCustomId('shop_p2').setLabel('⬅️ Strona 2').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('shop_p4').setLabel('Strona 4 ➡️').setStyle(ButtonStyle.Primary).setDisabled(data.total_fajerwerki < 20));
                } else if (page === 4) {
                    sEmbed.addFields({ name: '💎 Ulepszenie I', value: `+500k klik\nKoszt: 10M`, inline: true }, { name: '🔥 Ulepszenie II', value: `+5M klik\nKoszt: 100M`, inline: true });
                    r1.addComponents(new ButtonBuilder().setCustomId('buy_ulps1').setLabel('Kup I').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('buy_ulps2').setLabel('Kup II').setStyle(ButtonStyle.Success));
                    r2.addComponents(new ButtonBuilder().setCustomId('shop_p3').setLabel('⬅️ Strona 3').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('back_to_main').setLabel('🏠 Powrót').setStyle(ButtonStyle.Danger));
                }
                return await interaction.editReply({ embeds: [sEmbed], components: [r1, r2] });
            }

            // Główne menu magazynu
            if (interaction.customId === 'back_to_main' || interaction.customId === 'start_game') {
                const isStart = interaction.customId === 'start_game';
                const gEmbed = new EmbedBuilder().setTitle('🥂 Twój Magazyn').setImage(gameConfig.gfx.main_gif).setColor(gameConfig.gfx.color)
                    .addFields({ name: '✨ Proch:', value: `${formatProch(data.proch)}`, inline: true }, { name: '🚀 Mnożnik:', value: `${formatMult(curMult)}`, inline: true }, { name: '🎇 Fajerwerki:', value: `${data.fajerwerki_waluta}`, inline: true });
                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('click_proch').setLabel('Zabierz Proch! 🧨').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('open_shop').setLabel('Sklep 🛒').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('firework_boom').setLabel(`ODPAL (${formatProch(nextPresPrice)})`).setStyle(ButtonStyle.Danger)
                );

                if (isStart) {
                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                    const ch = await interaction.guild.channels.create({
                        name: `magazyn-${interaction.user.username}`,
                        parent: process.env.CATEGORY_ID || null,
                        permissionOverwrites: [
                            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                            { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                        ],
                    });
                    await ch.send({ content: `<@${userId}>`, embeds: [gEmbed], components: [btns] });
                    return await interaction.editReply({ content: `✅ Magazyn: ${ch}` });
                }
                return await interaction.editReply({ embeds: [gEmbed], components: [btns] });
            }

            // Klikanie (Zabierz Proch)
            if (interaction.customId === 'click_proch') {
                const itemsGain = (data.zimne_ognie * gameConfig.boosts.zimne_ognie) + (data.piccolo * gameConfig.boosts.piccolo) + (data.szampan * gameConfig.boosts.szampan_procenty) + (data.wyrzutnia * gameConfig.boosts.wyrzutnia_pro);
                const totalGain = Math.floor((1 + itemsGain) * curMult);
                db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(totalGain, userId);
                
                const upEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setFields(
                    { name: '✨ Proch:', value: `${formatProch(data.proch + totalGain)}`, inline: true },
                    { name: '🚀 Mnożnik:', value: `${formatMult(curMult)}`, inline: true },
                    { name: '🎇 Fajerwerki:', value: `${data.fajerwerki_waluta}`, inline: true }
                );
                return await interaction.editReply({ embeds: [upEmbed] });
            }

            // Odpalenie (Prestige)
            if (interaction.customId === 'firework_boom') {
                if (data.proch < nextPresPrice) {
                    return await interaction.followUp({ content: `❌ Wymagane: ${formatProch(nextPresPrice)}`, ephemeral: true });
                }
                
                // RESET (multiplier wraca do 1, ulepszenia z 4 strony znikają)
                db.prepare(`UPDATE players SET proch=0, multiplier=1, zimne_ognie=0, piccolo=0, szampan=0, wyrzutnia=0, dzik=0, brawlpass_count=0, total_fajerwerki=total_fajerwerki+1, fajerwerki_waluta=fajerwerki_waluta+1 WHERE userId=?`).run(userId);
                
                const fr = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
                const finalMult = (1) * fr.mega_multiplier * Math.pow(2, fr.total_fajerwerki);
                const nextPrice = gameConfig.prices.prestige_base * Math.pow(gameConfig.prices.prestige_scaling, fr.total_fajerwerki);

                const pEm = new EmbedBuilder().setTitle('🥂 Twój Magazyn').setImage(gameConfig.gfx.main_gif).setColor(gameConfig.gfx.color)
                    .setFields(
                        { name: '✨ Proch:', value: `0g`, inline: true },
                        { name: '🚀 Mnożnik:', value: `${formatMult(finalMult)}`, inline: true },
                        { name: '🎇 Fajerwerki:', value: `${fr.fajerwerki_waluta}`, inline: true }
                    );
                const pBtns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('click_proch').setLabel('Zabierz Proch! 🧨').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('open_shop').setLabel('Sklep 🛒').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('firework_boom').setLabel(`ODPAL (${formatProch(nextPrice)})`).setStyle(ButtonStyle.Danger)
                );
                return await interaction.editReply({ embeds: [pEm], components: [pBtns] });
            }

        } catch (e) { console.error(e); }
    }
};