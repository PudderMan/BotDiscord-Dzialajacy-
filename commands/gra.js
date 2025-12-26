const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
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
        
        // Zabezpieczenie przed brakiem kolumny pudelko przy pobieraniu
        let data;
        try {
            data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        } catch (err) {
            if (err.message.includes("no such column: pudelko")) {
                db.prepare("ALTER TABLE players ADD COLUMN pudelko INTEGER DEFAULT 0").run();
                data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
            }
        }

        if (!data) {
            db.prepare('INSERT INTO players (userId, proch, multiplier, mega_multiplier, total_fajerwerki, fajerwerki_waluta, dzik, max_dzik, zimne_ognie, piccolo, szampan, wyrzutnia, pudelko) VALUES (?, 10000, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0)').run(userId, 0); // Dodano 0 na końcu dla pudelko
            data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        }

        const multiplier = Number(data.multiplier) || 1;
        const megaMult = Number(data.mega_multiplier) || 1;
        const currentProch = Number(data.proch) || 0;
        const curMult = (multiplier + (Number(data.dzik) * gameConfig.boosts.dzik_val)) * megaMult;
        const nextPresPrice = gameConfig.prices.prestige_base * Math.pow(gameConfig.prices.prestige_scaling, data.total_fajerwerki);

        // --- KLIKANIE ---
        if (interaction.customId === 'click_proch') {
            const baseGain = 1 + 
                (Number(data.zimne_ognie) * gameConfig.boosts.zimne_ognie) + 
                (Number(data.piccolo) * gameConfig.boosts.piccolo) + 
                (Number(data.szampan) * gameConfig.boosts.szampan_procenty) + 
                (Number(data.wyrzutnia) * gameConfig.boosts.wyrzutnia_pro);
            
            const totalGain = Math.floor(baseGain * curMult);
            const newProchValue = currentProch + totalGain;
            
            db.prepare('UPDATE players SET proch = ? WHERE userId = ?').run(newProchValue, userId);

            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setFields(
                { name: '✨ Proch:', value: `${formatNum(newProchValue)}g`, inline: true },
                { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true },
                { name: '🎇 Fajerwerki:', value: `${data.fajerwerki_waluta}`, inline: true }
            );
            return interaction.update({ embeds: [updatedEmbed] });
        }

        // --- SKLEP ---
        if (interaction.customId === 'open_shop' || interaction.customId.startsWith('shop_p')) {
            const page = interaction.customId === 'open_shop' ? 1 : parseInt(interaction.customId.replace('shop_p', ''));
            
            const sEmbed = new EmbedBuilder().setTitle(`🛒 Sklep - Strona ${page}`).setColor('#2ECC71')
                .setDescription(`Twój Proch: **${formatNum(currentProch)}g** | 🎇: **${data.fajerwerki_waluta}**`);
            
            const rows = [];
            const row1 = new ActionRowBuilder();

            if (page === 1) {
                sEmbed.addFields(
                    { name: `🎇 Zimne (+${gameConfig.boosts.zimne_ognie}g)`, value: `Koszt: **${gameConfig.prices.zimne_ognie}g**`, inline: true },
                    { name: `🍾 Piccolo (+${gameConfig.boosts.piccolo}g)`, value: `Koszt: **${gameConfig.prices.piccolo}g**`, inline: true },
                    { name: `🥂 Szampan (+${gameConfig.boosts.szampan_procenty}g)`, value: `Koszt: **${gameConfig.prices.szampan_procenty}g**`, inline: true },
                    { name: `🚀 Wyrzutnia (+${gameConfig.boosts.wyrzutnia_pro}g)`, value: `Koszt: **${gameConfig.prices.wyrzutnia_pro}g**`, inline: true }
                );
                row1.addComponents(
                    new ButtonBuilder().setCustomId('buy_zimne').setLabel('Zimne').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_piccolo').setLabel('Piccolo').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_szampan').setLabel('Szampan').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_wyrzutnia').setLabel('Wyrzutnia').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('shop_p2').setLabel('➡️').setStyle(ButtonStyle.Primary)
                );
                rows.push(row1);
            } else if (page === 2) {
                const dzikCost = gameConfig.prices.dzik_prices[data.dzik] || "MAX";
                sEmbed.addFields(
                    { name: `🐗 Dzik (+${gameConfig.boosts.dzik_val})`, value: `Koszt: **${formatNum(dzikCost)}g**`, inline: true },
                    { name: `🌵 BrawlPass (+5)`, value: `Koszt: **500k**`, inline: true }
                );
                row1.addComponents(
                    new ButtonBuilder().setCustomId('shop_p1').setLabel('⬅️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('buy_dzik').setLabel('Kup Dzika').setStyle(ButtonStyle.Success).setDisabled(dzikCost === "MAX"),
                    new ButtonBuilder().setCustomId('buy_brawlpass').setLabel('BrawlPass').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('shop_p3').setLabel('➡️').setStyle(ButtonStyle.Primary)
                );
                rows.push(row1);
            }

            return (interaction.customId === 'open_shop') ? interaction.reply({ embeds: [sEmbed], components: rows, ephemeral: true }) : interaction.update({ embeds: [sEmbed], components: rows });
        }

        // --- START GRY (KANAŁ) ---
        if (interaction.customId === 'start_game') {
            await interaction.deferReply({ ephemeral: true });
            const ch = await interaction.guild.channels.create({
                name: `sylwester-${interaction.user.username}`,
                parent: process.env.CATEGORY_ID || null,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ],
            });

            const gEmbed = new EmbedBuilder().setTitle('🥂 Twój Magazyn').setImage(gameConfig.gfx.main_gif).setColor(gameConfig.gfx.color)
                .addFields(
                    { name: '✨ Proch:', value: `${formatNum(currentProch)}g`, inline: true },
                    { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true },
                    { name: '🎇 Fajerwerki:', value: `${data.fajerwerki_waluta}`, inline: true }
                );

            const btns = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('click_proch').setLabel('Zabierz Proch! 🧨').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('open_shop').setLabel('Sklep 🛒').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('firework_boom').setLabel(`ODPAL (${formatNum(nextPresPrice)})`).setStyle(ButtonStyle.Danger)
            );

            await ch.send({ embeds: [gEmbed], components: [btns] });
            return interaction.editReply({ content: `Magazyn gotowy: ${ch}` });
        }
    }
};