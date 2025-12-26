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
        .addSubcommand(sub =>
            sub.setName('config')
                .setDescription('Zarządzanie statystykami graczy')
                .addStringOption(o => o.setName('typ').setDescription('Waluta').setRequired(true).addChoices({ name: 'Proch', value: 'proch' }, { name: 'Fajerwerki', value: 'fajerwerki_waluta' }))
                .addUserOption(o => o.setName('gracz').setDescription('Użytkownik').setRequired(true))
                .addStringOption(o => o.setName('akcja').setDescription('Akcja').setRequired(true).addChoices({ name: 'Dodaj', value: 'add' }, { name: 'Zabierz', value: 'rem' }))
                .addIntegerOption(o => o.setName('ilosc').setDescription('Ilość').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('panel')
                .setDescription('Wysyła panel startowy gry')
        ),

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'config') {
            const typ = interaction.options.getString('typ');
            const target = interaction.options.getUser('gracz');
            const val = interaction.options.getInteger('ilosc');
            const sign = interaction.options.getString('akcja') === 'add' ? '+' : '-';

            db.prepare(`UPDATE players SET ${typ} = ${typ} ${sign} ? WHERE userId = ?`).run(val, target.id);
            return interaction.reply({ content: `✅ Zmieniono ${typ} o ${val}.`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('🎆 Sylwester 2025')
            .setDescription('Stwórz swój magazyn i zacznij zbierać proch!')
            .setColor(gameConfig.gfx.color);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('start_game').setLabel('Zacznij Przygodę! 🧨').setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleInteraction(interaction) {
        const userId = interaction.user.id;
        
        // Zawsze pobieraj najświeższe dane na początku interakcji
        let data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);

        if (!data) {
            db.prepare('INSERT INTO players (userId, proch, multiplier, mega_multiplier, total_fajerwerki, fajerwerki_waluta, dzik, max_dzik, zimne_ognie, piccolo, szampan, wyrzutnia, pudelko) VALUES (?, 10000, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0)').run(userId);
            data = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);
        }

        // Kalkulacja mnożnika
        const curMult = (Number(data.multiplier) + (Number(data.dzik) * gameConfig.boosts.dzik_val)) * Number(data.mega_multiplier);
        const nextPresPrice = gameConfig.prices.prestige_base * Math.pow(gameConfig.prices.prestige_scaling, data.total_fajerwerki);

        // --- PRZYCISK KLIKANIA ---
        if (interaction.customId === 'click_proch') {
            const gain = (1 + 
                (data.zimne_ognie * gameConfig.boosts.zimne_ognie) + 
                (data.piccolo * gameConfig.boosts.piccolo) + 
                (data.szampan * gameConfig.boosts.szampan_procenty) + 
                (data.wyrzutnia * gameConfig.boosts.wyrzutnia_pro)
            ) * curMult;
            
            db.prepare('UPDATE players SET proch = proch + ? WHERE userId = ?').run(gain, userId);
            
            // Pobieramy dane PO dodaniu prochu
            const updated = db.prepare('SELECT * FROM players WHERE userId = ?').get(userId);

            const newEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setFields(
                { name: '✨ Proch:', value: `${formatNum(updated.proch)}g`, inline: true },
                { name: '🚀 Mnożnik:', value: `x${curMult.toFixed(1)}`, inline: true },
                { name: '🎇 Fajerwerki:', value: `${updated.fajerwerki_waluta}`, inline: true }
            );

            return interaction.update({ embeds: [newEmbed] });
        }

        // --- SKLEP ---
        if (interaction.customId === 'open_shop' || interaction.customId.startsWith('shop_p')) {
            let p = interaction.customId === 'open_shop' ? 1 : parseInt(interaction.customId.replace('shop_p', ''));
            const sEmbed = new EmbedBuilder().setTitle(`🛒 Sklep s.${p}`).setColor('#2ECC71').setDescription(`Proch: **${formatNum(data.proch)}g** | 🎇: **${data.fajerwerki_waluta}**`);
            const row = new ActionRowBuilder();

            if (p === 1) {
                sEmbed.addFields(
                    { name: `🎇 Zimne (+${gameConfig.boosts.zimne_ognie})`, value: `${formatNum(gameConfig.prices.zimne_ognie)}g`, inline: true },
                    { name: `🍾 Piccolo (+${gameConfig.boosts.piccolo})`, value: `${formatNum(gameConfig.prices.piccolo)}g`, inline: true },
                    { name: `🥂 Szampan (+${gameConfig.boosts.szampan_procenty})`, value: `${formatNum(gameConfig.prices.szampan_procenty)}g`, inline: true },
                    { name: `🚀 Wyrzutnia (+${gameConfig.boosts.wyrzutnia_pro})`, value: `${formatNum(gameConfig.prices.wyrzutnia_pro)}g`, inline: true }
                );
                
                row.addComponents(
                    new ButtonBuilder().setCustomId('buy_zimne').setLabel('Zimne').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_piccolo').setLabel('Piccolo').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_szampan').setLabel('Szampan').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('buy_wyrzutnia').setLabel('Wyrzutnia').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('shop_p2').setLabel('➡️').setStyle(ButtonStyle.Primary)
                );
            } else if (p === 3) {
                sEmbed.addFields({ name: '📦 PACZKA FAJERWEREK', value: `Koszt: ${gameConfig.prices.paczka_fajerwerek_cost} 🎇\n\n**Efekt:**\n- Mega Boost x10 (na stałe)\n- Czyści postęp (oprócz 🎇)` });
                row.addComponents(
                    new ButtonBuilder().setCustomId('shop_p2').setLabel('⬅️').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('buy_paczka').setLabel('ODPAL PACZKĘ 🎆').setStyle(ButtonStyle.Danger)
                );
            }

            return interaction.customId === 'open_shop' 
                ? await interaction.reply({ embeds: [sEmbed], components: [row], ephemeral: true }) 
                : await interaction.update({ embeds: [sEmbed], components: [row] });
        }

        // --- PACZKA (RESET) ---
        if (interaction.customId === 'buy_paczka') {
            if (data.fajerwerki_waluta < gameConfig.prices.paczka_fajerwerek_cost) return interaction.reply({ content: "❌ Za mało 🎇!", ephemeral: true });
            
            db.prepare(`UPDATE players SET proch=0, multiplier=1, zimne_ognie=0, piccolo=0, szampan=0, wyrzutnia=0, dzik=0, total_fajerwerki=0, fajerwerki_waluta = fajerwerki_waluta - ?, mega_multiplier=10 WHERE userId=?`)
              .run(gameConfig.prices.paczka_fajerwerek_cost, userId);
            
            return interaction.reply({ content: "🚀 PACZKA ODPALONA! Zyskałeś Mega Boost x10 i zresetowałeś postęp.", ephemeral: false });
        }

        // --- WYSTRZAŁ (PRESTIGE) ---
        if (interaction.customId === 'firework_boom') {
            if (data.proch < nextPresPrice) return interaction.reply({ content: `❌ Brakuje Ci prochu! (Wymagane: ${formatNum(nextPresPrice)})`, ephemeral: true });

            db.prepare(`UPDATE players SET proch=0, zimne_ognie=0, piccolo=0, szampan=0, wyrzutnia=0, dzik=0, total_fajerwerki=total_fajerwerki+1, fajerwerki_waluta=fajerwerki_waluta+1 WHERE userId=?`).run(userId);
            return interaction.reply({ content: "🎆 WYSTRZELONO! Masz nową Fajerwerkę.", ephemeral: true });
        }

        // --- START GRY ---
        if (interaction.customId === 'start_game') {
            await interaction.deferReply({ ephemeral: true });
            const ch = await interaction.guild.channels.create({
                name: `sylwester-${interaction.user.username}`,
                parent: process.env.CATEGORY_ID,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ],
            });

            const gEmbed = new EmbedBuilder()
                .setTitle('🥂 Twój Magazyn')
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

            await ch.send({ content: `Witaj ${interaction.user}!`, embeds: [gEmbed], components: [btns] });
            return interaction.editReply({ content: `Kanał gotowy: ${ch}` });
        }
    }
};