const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../database.js');
const gameConfig = require('../config-gry.json');

const formatNum = (n) => {
    // Zabezpieczenie przed błędem toFixed na undefined
    if (n === undefined || n === null) return "0";
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return Math.floor(n).toString();
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gra')
        .setDescription('Główna komenda gry Sylwester 2025')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(s => s.setName('config').setDescription('Zarządzanie statystykami graczy')
            .addStringOption(o => o.setName('typ').setDescription('Wybierz walutę').setRequired(true).addChoices(
                { name: 'Proch', value: 'proch' },
                { name: 'Fajerwerki', value: 'fajerwerki_waluta' }
            ))
            .addUserOption(o => o.setName('gracz').setDescription('Wybierz użytkownika').setRequired(true))
            .addStringOption(o => o.setName('akcja').setDescription('Dodaj lub zabierz').setRequired(true).addChoices(
                { name: 'Dodaj', value: 'add' },
                { name: 'Zabierz', value: 'rem' }
            ))
            .addIntegerOption(o => o.setName('ilosc').setDescription('Wpisz ilość').setRequired(true)))
        .addSubcommand(s => s.setName('panel').setDescription('Wysyła panel startowy na kanał')),

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'config') {
            const typ = interaction.options.getString('typ');
            const target = interaction.options.getUser('gracz');
            const val = interaction.options.getInteger('ilosc');
            const sign = interaction.options.getString('akcja') === 'add' ? '+' : '-';
            db.prepare(`UPDATE players SET ${typ} = ${typ} ${sign} ? WHERE userId = ?`).run(val, target.id);
            return interaction.reply({ content: `✅ Zaktualizowano ${typ} dla ${target.username}.`, ephemeral: true });
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🎆 Sylwester 2025')
            .setDescription('Kliknij przycisk poniżej, aby stworzyć swój własny kanał i zacząć zbierać proch!')
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
            
            // Blokady stron sklepu
            if (p === 2 && data.fajerwerki_waluta < 2) return interaction.reply({ content: "❌ Wymagane 2 Fajerwerki w portfelu!", ephemeral: true });
            if (p === 3 && data.fajerwerki_waluta < 10) return interaction.reply({ content: "❌ Wymagane 10 Fajerwerków w portfelu!", ephemeral: true });
            if (p === 4 && data.mega_multiplier <= 1) return interaction.reply({ content: "❌ Musisz najpierw odpalić Paczkę Fajerwerek!", ephemeral: true });

            const sEmbed = new EmbedBuilder()
                .setTitle(`🛒 Sklep - Strona ${p}`)
                .setColor('#2ECC71')
                .setDescription(`Twój Proch: **${formatNum(data.proch)}g** | Fajerwerki: **${data.fajerwerki_waluta}**`);
            
            const row = new ActionRowBuilder();

            if (p === 1) {
                sEmbed.addFields(
                    { name: `🎇 Zimne Ognie (+${gameConfig.boosts.zimne_ognie})`, value: `${formatNum(gameConfig.prices.zimne_ognie)}g`, inline: true },
                    { name: `🍾 Piccolo (+${gameConfig.boosts.piccolo})`, value: `${formatNum(gameConfig.prices.piccolo)}g`, inline: true },
                    { name: `🥂 Szampan (+${gameConfig.boosts.szampan_procenty})`, value: `${formatNum(gameConfig.prices.szampan_procenty)}g`, inline: true },
                    { name: `📦 Pudełko (+${gameConfig.boosts.wyrzutnia_pro}/klik)`, value: `${formatNum(gameConfig.prices.wyrzutnia_pro_price)}g`, inline: true }
                );
                row.addComponents(
                    new ButtonBuilder().setCustomId('buy_zimne').setLabel('Zimne Ognie').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_piccolo').setLabel('Piccolo').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_szampan').setLabel('Szampan').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_box').setLabel('Pudełko (1x)').setStyle(ButtonStyle.Secondary).setDisabled(data.wyrzutnia > 0),
                    new ButtonBuilder().setCustomId('shop_p2').setLabel('➡️').setStyle(ButtonStyle.Primary)
                );
            } else if (p === 2) {
                const dzPrice = gameConfig.prices.dzik_prices[data.dzik] || 0;
                sEmbed.addFields(
                    { name: `🐗 Dzik (Mnożnik +${gameConfig.boosts.dzik_val})`, value: `${formatNum(dzPrice)}g`, inline: true },
                    { name: `🌵 BrawlPass (+${gameConfig.boosts.wyrzutnia_pro}/klik)`, value: `500k`, inline: true }
                );
                row.addComponents(
                    new ButtonBuilder().setCustomId('shop_p1').setLabel('⬅️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('buy_dzik').setLabel('Kup Dzika').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('buy_bs').setLabel('BrawlPass (∞)').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('shop_p3').setLabel('➡️').setStyle(ButtonStyle.Primary)
                );
            } else if (p === 3) {
                sEmbed.addFields({ name: '📦 PACZKA FAJERWEREK', value: `Koszt: 25 🎇\nResetuje postęp, daje x10 MEGA BOOST i +1 slot na Dzika!`, inline: false });
                row.addComponents(
                    new ButtonBuilder().setCustomId('shop_p2').setLabel('⬅️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('buy_paczka').setLabel('ODPAL PACZKĘ 🎆').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('shop_p4').setLabel('Sklep Specjalny 🎇').setStyle(ButtonStyle.Success)
                );
            } else if (p === 4) {
                sEmbed.addFields({ name: '🐗 Slot Dzika', value: `5 🎇`, inline: true }, { name: '🚀 Mega Boost x5', value: `3 🎇`, inline: true });
                row.addComponents(
                    new ButtonBuilder().setCustomId('shop_p3').setLabel('⬅️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('buy_fw_slot').setLabel('Kup Slot').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('buy_fw_mult').setLabel('Kup Boost').setStyle(ButtonStyle.Primary)
                );
            }

            return interaction.customId === 'open_shop' 
                ? await interaction.reply({ embeds: [sEmbed], components: [row], ephemeral: true }) 
                : await interaction.update({ embeds: [sEmbed], components: [row] });
        }

        // Logika zakupów
        const buyAction = (price, col, label, limit = 999) => {
            if (data.proch < price) return interaction.reply({ content: "❌ Za mało prochu!", ephemeral: true });
            if (data[col] >= limit) return interaction.reply({ content: "❌ Osiągnięto limit tego przedmiotu!", ephemeral: true });
            db.prepare(`UPDATE players SET proch = proch - ?, ${col} = ${col} + 1 WHERE userId = ?`).run(price, userId);
            interaction.reply({ content: `✅ Kupiono: ${label}!`, ephemeral: true });
        };

        if (interaction.customId === 'buy_zimne') buyAction(gameConfig.prices.zimne_ognie, 'zimne_ognie', 'Zimne Ognie');
        if (interaction.customId === 'buy_piccolo') buyAction(gameConfig.prices.piccolo, 'piccolo', 'Piccolo');
        if (interaction.customId === 'buy_szampan') buyAction(gameConfig.prices.szampan_procenty, 'szampan', 'Szampan');
        if (interaction.customId === 'buy_box') buyAction(gameConfig.prices.wyrzutnia_pro_price, 'wyrzutnia', 'Pudełko Fajerwerek', 1);
        if (interaction.customId === 'buy_bs') buyAction(500000, 'wyrzutnia', 'BrawlPass');

        if (interaction.customId === 'buy_dzik') {
            const price = gameConfig.prices.dzik_prices[data.dzik];
            if (price && data.dzik < data.max_dzik) buyAction(price, 'dzik', 'Dzik');
            else interaction.reply({ content: "❌ Brak wolnych slotów lub limit!", ephemeral: true });
        }

        if (interaction.customId === 'buy_fw_slot' && data.fajerwerki_waluta >= 5) {
            db.prepare('UPDATE players SET fajerwerki_waluta = fajerwerki_waluta - 5, max_dzik = max_dzik + 1 WHERE userId = ?').run(userId);
            interaction.reply({ content: "✅ Dodano nowy slot na Dzika!", ephemeral: true });
        }

        if (interaction.customId === 'buy_fw_mult' && data.fajerwerki_waluta >= 3) {
            db.prepare('UPDATE players SET fajerwerki_waluta = fajerwerki_waluta - 3, mega_multiplier = mega_multiplier * 5 WHERE userId = ?').run(userId);
            interaction.reply({ content: "🚀 Zakupiono Mega Boost x5!", ephemeral: true });
        }

        if (interaction.customId === 'firework_boom') {
            if (data.proch < nextPresPrice) return interaction.reply({ content: `❌ Potrzebujesz ${formatNum(nextPresPrice)}g prochu!`, ephemeral: true });
            db.prepare(`UPDATE players SET proch=0, zimne_ognie=0, piccolo=0, szampan=0, wyrzutnia=0, dzik=0, total_fajerwerki=total_fajerwerki+1, fajerwerki_waluta=fajerwerki_waluta+1, multiplier=multiplier*2 WHERE userId=?`).run(userId);
            interaction.reply({ content: "🎆 WYSTRZAŁ! Zyskujesz +1 Fajerwerkę i stały bonus x2.", ephemeral: true });
        }

        if (interaction.customId === 'buy_paczka') {
            if (data.fajerwerki_waluta < 25) return interaction.reply({ content: "❌ Potrzebujesz 25 Fajerwerków!", ephemeral: true });
            db.prepare(`UPDATE players SET proch=10000, zimne_ognie=0, piccolo=0, szampan=0, wyrzutnia=0, dzik=0, total_fajerwerki=0, fajerwerki_waluta=0, multiplier=1, max_dzik=max_dzik+1, mega_multiplier=mega_multiplier*10 WHERE userId=?`).run(userId);
            interaction.reply({ content: "🚀 POTĘŻNY WYSTRZAŁ! Paczka odpalona, Twój zysk wzrósł x10!", ephemeral: false });
        }

        if (interaction.customId === 'start_game') {
            await interaction.deferReply({ ephemeral: true });
            try {
                const ch = await interaction.guild.channels.create({
                    name: `sylwester-${interaction.user.username}`,
                    parent: process.env.CATEGORY_ID,
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ],
                });

                const gEmbed = new EmbedBuilder()
                    .setTitle('🥂 Magazyn Sylwestrowy')
                    .setImage(gameConfig.gfx.main_gif)
                    .setColor(gameConfig.gfx.color)
                    .addFields(
                        { name: '✨ Proch:', value: `${formatNum(data.proch)}g`, inline: true },
                        { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true },
                        { name: '🎇 Fajerwerki:', value: `${data.fajerwerki_waluta}`, inline: true }
                    );

                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('click_proch').setLabel('Zabierz Proch! 🧨').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('open_shop').setLabel('Sklep 🛒').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('firework_boom').setLabel(`ODPAL (${formatNum(nextPresPrice)})`).setStyle(ButtonStyle.Danger)
                );

                await ch.send({ content: `Witaj ${interaction.user}! Zacznij przygotowania.`, embeds: [gEmbed], components: [btns] });
                return interaction.editReply({ content: `Twój kanał: ${ch}` });
            } catch (e) {
                return interaction.editReply({ content: "❌ Błąd tworzenia kanału. Sprawdź CATEGORY_ID w .env." });
            }
        }
    }
};