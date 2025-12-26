const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../database.js');
const gameConfig = require('../config-gry.json');

const formatNum = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toFixed(0);
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gra')
        .setDescription('Sylwester 2025')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(s => s.setName('config')
            .setDescription('Admin')
            .addStringOption(o => o.setName('typ').setDescription('Waluta').setRequired(true).addChoices({name:'Proch',value:'proch'},{name:'Fajerwerki',value:'fajerwerki_waluta'}))
            .addUserOption(o => o.setName('gracz').setDescription('Gracz').setRequired(true))
            .addStringOption(o => o.setName('akcja').setDescription('Akcja').setRequired(true).addChoices({name:'Dodaj',value:'add'},{name:'Zabierz',value:'rem'}))
            .addIntegerOption(o => o.setName('ilosc').setDescription('Ilość').setRequired(true)))
        .addSubcommand(s => s.setName('panel').setDescription('Panel startowy')),

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'config') {
            const typ = interaction.options.getString('typ'), target = interaction.options.getUser('gracz'), val = interaction.options.getInteger('ilosc');
            const sign = interaction.options.getString('akcja') === 'add' ? '+' : '-';
            db.prepare(`UPDATE players SET ${typ} = ${typ} ${sign} ? WHERE userId = ?`).run(val, target.id);
            return interaction.reply({ content: `✅ Zmieniono ${typ} o ${val}`, ephemeral: true });
        }
        const embed = new EmbedBuilder().setTitle('🎆 Sylwester 2025').setDescription('Zacznij zbierać proch!').setColor(gameConfig.gfx.color);
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('start_game').setLabel('Zacznij! 🧨').setStyle(ButtonStyle.Danger));
        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleInteraction(interaction) {
        const userId = interaction.user.id;
        let data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        if (!data) { 
            db.prepare('INSERT INTO players (userId, proch, multiplier, mega_multiplier, total_fajerwerki, fajerwerki_waluta, dzik, max_dzik, zimne_ognie, piccolo, szampan, wyrzutnia) VALUES (?, 10000, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0)').run(userId);
            data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId); 
        }

        const curMult = (data.multiplier + (data.dzik * gameConfig.boosts.dzik_val)) * data.mega_multiplier;
        const nextPresPrice = 100000 * Math.pow(gameConfig.prices.prestige_scaling, data.total_fajerwerki);

        if (interaction.customId === 'click_proch') {
            const baseGain = (1 + (data.zimne_ognie * gameConfig.boosts.zimne_ognie) + (data.piccolo * gameConfig.boosts.piccolo) + (data.szampan * gameConfig.boosts.szampan_procenty)) * curMult;
            const finalGain = baseGain + (data.wyrzutnia * gameConfig.boosts.wyrzutnia_pro);
            db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(finalGain, userId);
            const fresh = db.prepare('SELECT proch FROM players WHERE userId = ?').get(userId);
            const newEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setFields(
                { name: '✨ Proch:', value: `${formatNum(fresh.proch)}g`, inline: true },
                { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true },
                { name: '🎇 Fajerwerki:', value: `${data.fajerwerki_waluta}`, inline: true }
            );
            return interaction.update({ embeds: [newEmbed] });
        }

        if (interaction.customId === 'open_shop' || interaction.customId.startsWith('shop_p')) {
            let p = interaction.customId === 'open_shop' ? 1 : parseInt(interaction.customId.replace('shop_p', ''));
            if ((p === 2 && data.fajerwerki_waluta < 2) || (p === 3 && data.fajerwerki_waluta < 10) || (p === 4 && data.mega_multiplier <= 1)) 
                return interaction.reply({ content: "❌ Brak uprawnień (fajerwerki)!", ephemeral: true });

            const sEmbed = new EmbedBuilder().setTitle(`🛒 Sklep s.${p}`).setColor('#2ECC71').setDescription(`Proch: **${formatNum(data.proch)}g** | Fajerwerki: **${data.fajerwerki_waluta}**`);
            const row = new ActionRowBuilder();

            if (p === 1) {
                sEmbed.addFields({ name: '🎇 Zimne', value: `${formatNum(gameConfig.prices.zimne_ognie)}g`, inline: true }, { name: '🍾 Piccolo', value: `${formatNum(gameConfig.prices.piccolo)}g`, inline: true }, { name: '🥂 Szampan', value: `${formatNum(gameConfig.prices.szampan_procenty)}g`, inline: true }, { name: '🚀 Wyrzutnia (1x)', value: `${formatNum(gameConfig.prices.wyrzutnia_pro)}g`, inline: true });
                row.addComponents(
                    new ButtonBuilder().setCustomId('buy_zimne').setLabel('Zimne').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_piccolo').setLabel('Piccolo').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_szampan').setLabel('Szampan').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_wyrzutnia').setLabel('Wyrzutnia').setStyle(ButtonStyle.Secondary).setDisabled(data.wyrzutnia > 0),
                    new ButtonBuilder().setCustomId('shop_p2').setLabel('➡️').setStyle(ButtonStyle.Primary)
                );
            } else if (p === 2) {
                const dzPrice = gameConfig.prices.dzik_prices[data.dzik] || 0;
                sEmbed.addFields({ name: '🐗 Dzik', value: `${formatNum(dzPrice)}g`, inline: true }, { name: '🌵 BrawlPass (∞)', value: `500k`, inline: true });
                row.addComponents(
                    new ButtonBuilder().setCustomId('shop_p1').setLabel('⬅️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('buy_dzik').setLabel('Dzik').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('buy_bs').setLabel('BrawlPass').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('shop_p3').setLabel('➡️').setStyle(ButtonStyle.Primary)
                );
            } else if (p === 3) {
                sEmbed.addFields({ name: '📦 PACZKA', value: `Koszt: 25 🎇`, inline: false });
                row.addComponents(new ButtonBuilder().setCustomId('shop_p2').setLabel('⬅️').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('buy_paczka').setLabel('WYSTRZEL PACZKĘ 🎆').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('shop_p4').setLabel('Sklep 🎇').setStyle(ButtonStyle.Success));
            } else if (p === 4) {
                sEmbed.addFields({ name: '🐗 Slot', value: `5 🎇`, inline: true }, { name: '🚀 Boost x5', value: `3 🎇`, inline: true });
                row.addComponents(new ButtonBuilder().setCustomId('shop_p3').setLabel('⬅️').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('buy_fw_slot').setLabel('Slot').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('buy_fw_mult').setLabel('Boost').setStyle(ButtonStyle.Primary));
            }
            return interaction.customId === 'open_shop' ? interaction.reply({ embeds: [sEmbed], components: [row], ephemeral: true }) : interaction.update({ embeds: [sEmbed], components: [row] });
        }

        const buy = (price, col, label, max = 999) => {
            if (data.proch < price) return interaction.reply({ content: "Brak prochu!", ephemeral: true });
            if (data[col] >= max) return interaction.reply({ content: "Osiągnięto limit!", ephemeral: true });
            db.prepare(`UPDATE players SET proch = proch - ?, ${col} = ${col} + 1 WHERE userId = ?`).run(price, userId);
            interaction.reply({ content: `✅ Kupiono: ${label}`, ephemeral: true });
        };

        if (interaction.customId === 'buy_zimne') buy(gameConfig.prices.zimne_ognie, 'zimne_ognie', 'Zimne');
        if (interaction.customId === 'buy_piccolo') buy(gameConfig.prices.piccolo, 'piccolo', 'Piccolo');
        if (interaction.customId === 'buy_szampan') buy(gameConfig.prices.szampan_procenty, 'szampan', 'Szampan');
        if (interaction.customId === 'buy_wyrzutnia') buy(gameConfig.prices.wyrzutnia_pro, 'wyrzutnia', 'Wyrzutnię', 1);
        if (interaction.customId === 'buy_bs') buy(500000, 'wyrzutnia', 'BrawlPass');
        
        if (interaction.customId === 'buy_dzik') {
            const price = gameConfig.prices.dzik_prices[data.dzik];
            if (price && data.dzik < data.max_dzik) buy(price, 'dzik', 'Dzika');
            else interaction.reply({ content: "Limit dzików!", ephemeral: true });
        }

        if (interaction.customId === 'buy_fw_slot' && data.fajerwerki_waluta >= 5) {
            db.prepare('UPDATE players SET fajerwerki_waluta = fajerwerki_waluta - 5, max_dzik = max_dzik + 1 WHERE userId = ?').run(userId);
            interaction.reply({ content: "✅ Dodano slot na dzika!", ephemeral: true });
        }

        if (interaction.customId === 'buy_fw_mult' && data.fajerwerki_waluta >= 3) {
            db.prepare('UPDATE players SET fajerwerki_waluta = fajerwerki_waluta - 3, mega_multiplier = mega_multiplier * 5 WHERE userId = ?').run(userId);
            interaction.reply({ content: "🚀 Mega Boost x5!", ephemeral: true });
        }

        if (interaction.customId === 'firework_boom' && data.proch >= nextPresPrice) {
            db.prepare(`UPDATE players SET proch=0, zimne_ognie=0, piccolo=0, szampan=0, wyrzutnia=0, dzik=0, total_fajerwerki=total_fajerwerki+1, fajerwerki_waluta=fajerwerki_waluta+1, multiplier=multiplier*2 WHERE userId=?`).run(userId);
            interaction.reply({ content: "🎆 WYSTRZELONO! +1 Fajerwerka", ephemeral: true });
        }

        if (interaction.customId === 'buy_paczka' && data.fajerwerki_waluta >= 25) {
            db.prepare(`UPDATE players SET proch=10000, zimne_ognie=0, piccolo=0, szampan=0, wyrzutnia=0, dzik=0, total_fajerwerki=0, fajerwerki_waluta=0, multiplier=1, max_dzik=max_dzik+1, mega_multiplier=mega_multiplier*10 WHERE userId=?`).run(userId);
            interaction.reply({ content: "🚀 PACZKA WYSTRZELONA! MEGA RESET!", ephemeral: false });
        }

        if (interaction.customId === 'start_game') {
            await interaction.deferReply({ ephemeral: true });
            const ch = await interaction.guild.channels.create({
                name: `sylwester-${interaction.user.username}`,
                parent: process.env.CATEGORY_ID,
                permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }],
            });
            const gEmbed = new EmbedBuilder().setTitle('🥂 Magazyn').setImage(gameConfig.gfx.main_gif).setColor(gameConfig.gfx.color)
                .addFields({ name: '✨ Proch:', value: `${formatNum(data.proch)}g`, inline: true }, { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true }, { name: '🎇 Fajerwerki:', value: `${data.fajerwerki_waluta}`, inline: true });
            const btns = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('click_proch').setLabel('Klikaj! 🧨').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('open_shop').setLabel('Sklep 🛒').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('firework_boom').setLabel(`ODPAL (${formatNum(nextPresPrice)})`).setStyle(ButtonStyle.Danger));
            await ch.send({ content: `Witaj ${interaction.user}!`, embeds: [gEmbed], components: [btns] });
            return interaction.editReply({ content: `Kanał: ${ch}` });
        }
    }
};