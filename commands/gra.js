const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../database.js');
const gameConfig = require('../config-gry.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gra')
        .setDescription('Zarządzanie grą Sylwester 2025')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(s => s.setName('config')
            .setDescription('Zarządzaj statystykami gracza')
            .addStringOption(o => o.setName('typ').setDescription('Waluta').setRequired(true).addChoices({name:'Proch',value:'proch'},{name:'Fajerwerki',value:'fajerwerki_waluta'}))
            .addUserOption(o => o.setName('gracz').setDescription('Gracz').setRequired(true))
            .addStringOption(o => o.setName('akcja').setDescription('Dodaj/Zabierz').setRequired(true).addChoices({name:'Dodaj',value:'add'},{name:'Zabierz',value:'rem'}))
            .addIntegerOption(o => o.setName('ilosc').setDescription('Ilość').setRequired(true)))
        .addSubcommand(s => s.setName('panel').setDescription('Wyślij panel startowy')),

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'config') {
            const typ = interaction.options.getString('typ');
            const target = interaction.options.getUser('gracz');
            const val = interaction.options.getInteger('ilosc');
            const sign = interaction.options.getString('akcja') === 'add' ? '+' : '-';
            db.prepare(`UPDATE players SET ${typ} = ${typ} ${sign} ? WHERE userId = ?`).run(val, target.id);
            return interaction.reply({ content: `✅ Zmieniono ${typ} dla ${target.username} o ${val}.`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('🎆 Wielkie Przygotowania do Sylwestra!')
            .setDescription('Potrzebujemy prochu na największy pokaz fajerwerków!\n\nKliknij przycisk poniżej, aby otrzymać własny kanał!')
            .setColor(gameConfig.gfx.color);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_game').setLabel('Zacznij zbierać proch! 🧨').setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleInteraction(interaction) {
        const userId = interaction.user.id;
        let data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        if (!data) {
            db.prepare('INSERT INTO players (userId, proch) VALUES (?, 10000)').run(userId);
            data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        }

        const curMult = (data.multiplier + (data.dzik * gameConfig.boosts.dzik_val)) * data.mega_multiplier;
        const nextPresPrice = gameConfig.prices.prestige_base * Math.pow(gameConfig.prices.prestige_scaling, data.total_fajerwerki);

        if (interaction.customId === 'click_proch') {
            const gain = (1 + (data.zimne_ognie * gameConfig.boosts.zimne_ognie) + (data.piccolo * gameConfig.boosts.piccolo) + (data.szampan * gameConfig.boosts.szampan_procenty) + (data.wyrzutnia * gameConfig.boosts.wyrzutnia_pro)) * curMult;
            db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(gain, userId);
            const fresh = db.prepare('SELECT proch FROM players WHERE userId = ?').get(userId);
            const newEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setFields(
                { name: '✨ Proch:', value: `${fresh.proch.toFixed(0)}g`, inline: true },
                { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true },
                { name: '🎇 Fajerwerki:', value: `${data.fajerwerki_waluta}`, inline: true }
            );
            return interaction.update({ embeds: [newEmbed] });
        }

        if (interaction.customId === 'open_shop' || interaction.customId.startsWith('shop_p')) {
            let p = interaction.customId === 'open_shop' ? 1 : parseInt(interaction.customId.replace('shop_p', ''));
            
            if (p === 2 && data.fajerwerki_waluta < 2) return interaction.reply({ content: "❌ Wymagane min. 2 Fajerwerki w portfelu!", ephemeral: true });
            if (p === 3 && data.fajerwerki_waluta < 10) return interaction.reply({ content: "❌ Wymagane min. 10 Fajerwerków w portfelu!", ephemeral: true });
            if (p === 4 && data.mega_multiplier <= 1) return interaction.reply({ content: "❌ Wymagana Paczka Fajerwerek!", ephemeral: true });

            const sEmbed = new EmbedBuilder().setTitle(`🛒 Sklep - Strona ${p}`).setColor('#2ECC71').setDescription(`Proch: **${data.proch.toFixed(0)}g** | Fajerwerki: **${data.fajerwerki_waluta}**`);
            const rows = [new ActionRowBuilder()];

            if (p === 1) {
                sEmbed.addFields(
                    { name: '🎇 Zimne Ognie', value: `${gameConfig.prices.zimne_ognie}g`, inline: true },
                    { name: '🍾 Piccolo', value: `${gameConfig.prices.piccolo}g`, inline: true },
                    { name: '🥂 Szampan %', value: `${gameConfig.prices.szampan_procenty}g`, inline: true },
                    { name: '🚀 Wyrzutnia Pro', value: `${gameConfig.prices.wyrzutnia_pro}g`, inline: true }
                );
                rows[0].addComponents(
                    new ButtonBuilder().setCustomId('buy_zimne').setLabel('Zimne Ognie').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_piccolo').setLabel('Piccolo').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_szampan').setLabel('Szampan').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('shop_p2').setLabel('Dalej ➡️').setStyle(ButtonStyle.Primary)
                );
            } else if (p === 2) {
                const dzPrice = gameConfig.prices.dzik_prices[data.dzik] || "MAX";
                sEmbed.addFields(
                    { name: `🐗 DZIK (${data.dzik}/${data.max_dzik})`, value: `${dzPrice}g`, inline: true },
                    { name: `🌵 BrawlPass`, value: `500000g`, inline: true }
                );
                rows[0].addComponents(
                    new ButtonBuilder().setCustomId('shop_p1').setLabel('⬅️ Wstecz').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('buy_dzik').setLabel('Kup Dzika').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('buy_bs').setLabel('BrawlPass').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('shop_p3').setLabel('Dalej ➡️').setStyle(ButtonStyle.Primary)
                );
            } else if (p === 3) {
                sEmbed.addFields({ name: '📦 PACZKA FAJERWEREK', value: `Koszt: 25 🎇\nResetuje wszystko, MEGA BOOST x10 i +1 Max Dzik!`, inline: false });
                rows[0].addComponents(
                    new ButtonBuilder().setCustomId('shop_p2').setLabel('⬅️ Wstecz').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('buy_paczka').setLabel('WYSTRZEL PACZKĘ 🎆').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('shop_p4').setLabel('Sklep 🎇').setStyle(ButtonStyle.Success)
                );
            } else if (p === 4) {
                sEmbed.setTitle('🎇 Sklep Specjalny').addFields(
                    { name: '🐗 Slot Dzika', value: `5 🎇`, inline: true },
                    { name: '🚀 Mega Boost x5', value: `3 🎇`, inline: true }
                );
                rows[0].addComponents(
                    new ButtonBuilder().setCustomId('shop_p3').setLabel('⬅️ Wstecz').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('buy_fw_slot').setLabel('Kup Slot').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('buy_fw_mult').setLabel('Kup Boost').setStyle(ButtonStyle.Primary)
                );
            }

            if (interaction.customId === 'open_shop') {
                return await interaction.reply({ embeds: [sEmbed], components: rows, ephemeral: true });
            } else {
                return await interaction.update({ embeds: [sEmbed], components: rows });
            }
        }

        const buy = (price, col, label) => {
            if (data.proch < price) return interaction.reply({ content: "Brak prochu!", ephemeral: true });
            db.prepare(`UPDATE players SET proch = proch - ?, ${col} = ${col} + 1 WHERE userId = ?`).run(price, userId);
            interaction.reply({ content: `✅ Kupiono: ${label}!`, ephemeral: true });
        };

        if (interaction.customId === 'buy_zimne') buy(gameConfig.prices.zimne_ognie, 'zimne_ognie', 'Zimne Ognie');
        if (interaction.customId === 'buy_piccolo') buy(gameConfig.prices.piccolo, 'piccolo', 'Piccolo');
        if (interaction.customId === 'buy_szampan') buy(gameConfig.prices.szampan_procenty, 'szampan', 'Szampan');
        if (interaction.customId === 'buy_bs') buy(500000, 'wyrzutnia', 'BrawlPass');
        if (interaction.customId === 'buy_dzik') {
            const price = gameConfig.prices.dzik_prices[data.dzik];
            if (!price || data.dzik >= data.max_dzik) return interaction.reply({ content: "Limit!", ephemeral: true });
            buy(price, 'dzik', 'Dzika');
        }

        if (interaction.customId === 'buy_fw_slot') {
            if (data.fajerwerki_waluta < 5) return interaction.reply({ content: "Brak 🎇", ephemeral: true });
            db.prepare('UPDATE players SET fajerwerki_waluta = fajerwerki_waluta - 5, max_dzik = max_dzik + 1 WHERE userId = ?').run(userId);
            interaction.reply({ content: "✅ Slot dodany!", ephemeral: true });
        }

        if (interaction.customId === 'buy_fw_mult') {
            if (data.fajerwerki_waluta < 3) return interaction.reply({ content: "Brak 🎇", ephemeral: true });
            db.prepare('UPDATE players SET fajerwerki_waluta = fajerwerki_waluta - 3, mega_multiplier = mega_multiplier * 5 WHERE userId = ?').run(userId);
            interaction.reply({ content: "🚀 Boost x5!", ephemeral: true });
        }

        if (interaction.customId === 'firework_boom') {
            if (data.proch < nextPresPrice) return interaction.reply({ content: "Brak prochu!", ephemeral: true });
            db.prepare(`UPDATE players SET proch=0, zimne_ognie=0, piccolo=0, szampan=0, wyrzutnia=0, dzik=0, total_fajerwerki=total_fajerwerki+1, fajerwerki_waluta=fajerwerki_waluta+1, multiplier=multiplier*2 WHERE userId=?`).run(userId);
            interaction.reply({ content: "🎆 +1 Fajerwerk!", ephemeral: true });
        }

        if (interaction.customId === 'buy_paczka') {
            if (data.fajerwerki_waluta < 25) return interaction.reply({ content: "Brak 25 🎇", ephemeral: true });
            db.prepare(`UPDATE players SET proch=10000, zimne_ognie=0, piccolo=0, szampan=0, wyrzutnia=0, dzik=0, total_fajerwerki=0, fajerwerki_waluta=0, multiplier=1, max_dzik=max_dzik+1, mega_multiplier=mega_multiplier*10 WHERE userId=?`).run(userId);
            interaction.reply({ content: "🚀 PACZKA WYSTRZELONA!" });
        }

        if (interaction.customId === 'start_game') {
            await interaction.deferReply({ ephemeral: true });
            const ch = await interaction.guild.channels.create({
                name: `sylwester-${interaction.user.username}`,
                parent: process.env.CATEGORY_ID,
                permissionOverwrites: [{ id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }],
            });
            const gEmbed = new EmbedBuilder().setTitle('🥂 Twój Sylwestrowy Magazyn').setImage(gameConfig.gfx.main_gif).setColor(gameConfig.gfx.color)
                .addFields({ name: '✨ Proch:', value: `${data.proch.toFixed(0)}g`, inline: true }, { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true }, { name: '🎇 Fajerwerki:', value: `${data.fajerwerki_waluta}`, inline: true });
            const btns = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('click_proch').setLabel('Klikaj! 🧨').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('open_shop').setLabel('Sklep 🛒').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('firework_boom').setLabel(`ODPAL (${nextPresPrice.toFixed(0)}g)`).setStyle(ButtonStyle.Danger)
            );
            await ch.send({ content: `Witaj ${interaction.user}!`, embeds: [gEmbed], components: [btns] });
            return interaction.editReply({ content: `Kanał: ${ch}` });
        }
    }
};