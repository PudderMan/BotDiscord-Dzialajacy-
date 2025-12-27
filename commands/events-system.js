const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ComponentType } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Funkcja ładująca konfigurację z pliku w tym samym folderze
const loadConfig = () => {
    try {
        const filePath = path.join(__dirname, 'configpytan.json');
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        console.error("❌ BŁĄD: Nie można odczytać pliku configpytan.json!", err);
        return null;
    }
};

module.exports = {
    init(client) {
        console.log("✅ System Eventów (16-20) Aktywny. Nagrody RĘCZNE.");
        
        // Pętla sprawdzająca czas co minutę
        setInterval(async () => {
            const now = new Date();
            const h = now.getHours();
            const m = now.getMinutes();

            // Okno czasowe 16:00 - 20:00, sprawdzanie co 30 minut (:00 i :30)
            if (h >= 16 && h < 20 && (m === 0 || m === 30)) {
                if (Math.random() < 0.5) { // 50% szansy na pojawienie się pytania
                    await this.triggerEvent(client);
                }
            }
        }, 60000);

        // Globalny listener dla przycisków
        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isButton()) return;
            if (interaction.customId.startsWith('event_join_')) {
                const kategoria = interaction.customId.replace('event_join_', '');
                await this.createPrivateQuestion(interaction, kategoria);
            }
        });
    },

    async triggerEvent(client) {
        try {
            const channel = await client.channels.fetch(process.env.EVENT_CHANNEL_ID);
            if (!channel) return console.error("❌ Nie znaleziono kanału ogłoszeń eventu!");

            const config = loadConfig();
            if (!config) return;

            const kats = Object.keys(config.kategorie);
            const wybranakat = kats[Math.floor(Math.random() * kats.length)];

            const embed = new EmbedBuilder()
                .setTitle(`🔔 KONKURS: ${wybranakat.toUpperCase()}`)
                .setDescription(`Pojawiło się pytanie! Pierwsza osoba klika i odpowiada.\nKategoria: **${wybranakat}**`)
                .setColor('#27ae60');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`event_join_${wybranakat}`)
                    .setLabel('Zgłoś się! 🙋‍♂️')
                    .setStyle(ButtonStyle.Success)
            );

            const msg = await channel.send({ embeds: [embed], components: [row] });

            // Kolektor wyłączający przycisk po pierwszym kliknięciu
            const collector = msg.createMessageComponentCollector({ max: 1, time: 55000 });
            collector.on('collect', async (i) => {
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('x').setLabel('Zajęte!').setStyle(ButtonStyle.Secondary).setDisabled(true)
                );
                await i.update({ components: [disabledRow] });
            });
        } catch (error) {
            console.error("Błąd triggerEvent:", error);
        }
    },

    async createPrivateQuestion(interaction, kategoria) {
        const config = loadConfig();
        const pytaniaZKat = config.kategorie[kategoria];
        const pytanie = pytaniaZKat[Math.floor(Math.random() * pytaniaZKat.length)];
        const nagroda = config.nagrody[Math.floor(Math.random() * config.nagrody.length)];

        try {
            const guild = interaction.guild;
            const categoryId = process.env.EVENT_CATEGORY_ID;

            // Tworzenie kanału tekstowego w kategorii
            const channel = await guild.channels.create({
                name: `${interaction.user.username}-${kategoria}`,
                type: 0, 
                parent: categoryId,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                ],
            });

            const qEmbed = new EmbedBuilder()
                .setTitle(`PYTANIE: ${kategoria.toUpperCase()}`)
                .setDescription(`**${pytanie.p}**\n\nMasz **10 sekund** na odpowiedź!`)
                .setColor('#f39c12');

            // Losowa kolejność odpowiedzi
            const shuffledOptions = pytanie.o.sort(() => Math.random() - 0.5);
            const row = new ActionRowBuilder().addComponents(
                shuffledOptions.map(opt => 
                    new ButtonBuilder()
                        .setCustomId(opt === pytanie.pop ? 'q_correct' : `q_wrong_${Math.random()}`)
                        .setLabel(opt)
                        .setStyle(ButtonStyle.Primary)
                )
            );

            const m = await channel.send({ content: `<@${interaction.user.id}>`, embeds: [qEmbed], components: [row] });
            const collector = m.createMessageComponentCollector({ componentType: ComponentType.Button, time: 10000 });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) return i.reply({ content: "To nie Twoje pytanie!", ephemeral: true });

                if (i.customId === 'q_correct') {
                    await i.update({ 
                        content: `✅ **POPRAWNIE!**\nGracz: <@${i.user.id}>\nWygrana: **${nagroda}**\n\n*Nagroda zostanie przyznana ręcznie przez administrację.*`, 
                        embeds: [], 
                        components: [] 
                    });
                } else {
                    await i.update({ 
                        content: `❌ **BŁĄD!**\nPoprawna odpowiedź to: **${pytanie.pop}**.`, 
                        embeds: [], 
                        components: [] 
                    });
                }
                collector.stop('done');
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') await channel.send("⏰ **KONIEC CZASU!**");
                await channel.send("🏁 Kanał zostanie usunięty za 5 sekund.");
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            });

        } catch (e) {
            console.error("❌ Błąd tworzenia kanału:", e);
        }
    },

    async triggerManual(client) {
        await this.triggerEvent(client);
    }
};