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
            .setDescription('Kliknij przycisk poniżej, aby stworzyć swój magazyn!')
            .setColor(gameConfig.gfx.color);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_game').setLabel('Zacznij Przygodę! 🧨').setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleInteraction(interaction) {
        const userId = interaction.user.id;
        let data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);

        // Naprawa błędu "RangeError: Too many parameter values" - 14 kolumn = 14 znaków zapytania
        if (!data) {
            db.prepare(`
                INSERT INTO players (
                    userId, proch, multiplier, mega_multiplier, total_fajerwerki, 
                    fajerwerki_waluta, dzik, max_dzik, zimne_ognie, piccolo, 
                    szampan, wyrzutnia, pudelko, brawlpass_count
                ) VALUES (?, 10000, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0)
            `).run(userId);
            data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        }

        const prestigeMult = Math.pow(2, Number(data.total_fajerwerki)); 
        const curMult = (Number(data.multiplier) + (Number(data.dzik) * gameConfig.boosts.dzik_val)) * Number(data.mega_multiplier) * prestigeMult;
        const nextPresPrice = Number(gameConfig.prices.prestige_base) * Math.pow(Number(gameConfig.prices.prestige_scaling), Number(data.total_fajerwerki));
        const currentBpPrice = gameConfig.prices.brawlpass_base * Math.pow(gameConfig.prices.brawlpass_scaling, data.brawlpass_count);

        // --- SKLEP (Naprawa błędu ReferenceError: rowItems) ---
        if (interaction.customId === 'open_shop' || interaction.customId.startsWith('shop_p')) {
            const page = interaction.customId === 'open_shop' ? 1 : parseInt(interaction.customId.replace('shop_p', ''));
            
            if (page === 2 && data.fajerwerki_waluta < 2) return interaction.reply({ content: "❌ Wymagane 2 🎇!", flags: [MessageFlags.Ephemeral] });
            if (page === 3 && data.fajerwerki_waluta < 10) return interaction.reply({ content: "❌ Wymagane 10 🎇!", flags: [MessageFlags.Ephemeral] });

            const sEmbed = new EmbedBuilder().setTitle(`🛒 Sklep - Str. ${page}`).setColor('#2ECC71')
                .setDescription(`Proch: **${formatNum(data.proch)}g** | 🎇: **${data.fajerwerki_waluta}**`);
            
            const rows = [new ActionRowBuilder(), new ActionRowBuilder()];

            if (page === 1) {
                sEmbed.addFields({ name: `🎇 Zimne (+${gameConfig.boosts.zimne_ognie}g)`, value: `**${gameConfig.prices.zimne_ognie}g**`, inline: true });
                rows[0].addComponents(
                    new ButtonBuilder().setCustomId('buy_zimne').setLabel('Zimne').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_piccolo').setLabel('Piccolo').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_szampan').setLabel('Szampan').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_wyrzutnia').setLabel('Wyrzutnia').setStyle(ButtonStyle.Secondary)
                );
                rows[1].addComponents(new ButtonBuilder().setCustomId('shop_p2').setLabel('Str. 2 (2🎇) ➡️').setStyle(ButtonStyle.Primary));
            } else if (page === 2) {
                const dzikCost = gameConfig.prices.dzik_prices[data.dzik] || "MAX";
                rows[0].addComponents(
                    new ButtonBuilder().setCustomId('buy_dzik').setLabel('Dzik').setStyle(ButtonStyle.Success).setDisabled(dzikCost === "MAX"),
                    new ButtonBuilder().setCustomId('buy_brawlpass').setLabel('BrawlPass').setStyle(ButtonStyle.Danger).setDisabled(data.brawlpass_count >= gameConfig.boosts.brawlpass_limit)
                );
                rows[1].addComponents(
                    new ButtonBuilder().setCustomId('shop_p1').setLabel('⬅️ Str. 1').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('shop_p3').setLabel('Str. 3 (10🎇) ➡️').setStyle(ButtonStyle.Primary)
                );
            } else if (page === 3) {
                rows[0].addComponents(new ButtonBuilder().setCustomId('buy_paczka').setLabel('ODPAL PACZKĘ 🎆').setStyle(ButtonStyle.Danger));
                rows[1].addComponents(new ButtonBuilder().setCustomId('shop_p2').setLabel('⬅️ Str. 2').setStyle(ButtonStyle.Primary));
            }

            const response = { embeds: [sEmbed], components: rows, flags: [MessageFlags.Ephemeral] };
            return interaction.customId === 'open_shop' ? interaction.reply(response) : interaction.update(response);
        }

        // --- KLIKANIE ---
        if (interaction.customId === 'click_proch') {
            const baseGain = 1 + (data.zimne_ognie * gameConfig.boosts.zimne_ognie) + (data.piccolo * gameConfig.boosts.piccolo);
            const totalGain = Math.floor(baseGain * curMult);
            db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(totalGain, userId);
            
            const upEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setFields(
                { name: '✨ Proch:', value: `${formatNum(data.proch + totalGain)}g`, inline: true },
                { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true },
                { name: '🎇 Fajerwerki:', value: `${data.fajerwerki_waluta}`, inline: true }
            );
            return interaction.update({ embeds: [upEmbed] });
        }

        // --- START GRY ---
        if (interaction.customId === 'start_game') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const ch = await interaction.guild.channels.create({
                name: `sylwester-${interaction.user.username}`,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ],
            });

            const gEmbed = new EmbedBuilder().setTitle('🥂 Twój Magazyn').setColor(gameConfig.gfx.color)
                .addFields({ name: '✨ Proch:', value: `${formatNum(data.proch)}g`, inline: true }, { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true }, { name: '🎇 Fajerwerki:', value: `${data.fajerwerki_waluta}`, inline: true });

            const btns = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('click_proch').setLabel('Zabierz Proch! 🧨').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('open_shop').setLabel('Sklep 🛒').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('firework_boom').setLabel(`ODPAL (${formatNum(nextPresPrice)})`).setStyle(ButtonStyle.Danger)
            );

            await ch.send({ embeds: [gEmbed], components: [btns] });
            return interaction.editReply({ content: `Gotowe: ${ch}` });
        }
    }
};