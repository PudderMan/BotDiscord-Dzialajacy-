const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

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
        console.log("✅ System Eventów Aktywny. Czas na odpowiedź: 20s. Nagrody: RĘCZNE.");
        
        setInterval(async () => {
            const now = new Date();
            const h = now.getHours();
            const m = now.getMinutes();
            if (h >= 16 && h < 20 && (m === 0 || m === 30)) {
                if (Math.random() < 0.5) await this.triggerEvent(client);
            }
        }, 60000);

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
            const channelId = process.env.EVENT_CHANNEL_ID;
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel) return console.error("❌ BŁĄD: Nie znaleziono kanału ogłoszeń!");

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
            const collector = msg.createMessageComponentCollector({ max: 1, time: 55000 });
            collector.on('collect', async (i) => {
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('x').setLabel('Zajęte!').setStyle(ButtonStyle.Secondary).setDisabled(true)
                );
                await i.update({ components: [disabledRow] });
            });
        } catch (error) { console.error("Błąd triggerEvent:", error); }
    },

    async createPrivateQuestion(interaction, kategoria) {
        const config = loadConfig();
        const pytaniaZKat = config.kategorie[kategoria];
        const pytanie = pytaniaZKat[Math.floor(Math.random() * pytaniaZKat.length)];
        const nagroda = config.nagrody[Math.floor(Math.random() * config.nagrody.length)];

        try {
            const guild = interaction.guild;
            const categoryId = process.env.EVENT_CATEGORY_ID;

            // Tworzenie kanału
            const channel = await guild.channels.create({
                name: `event-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                ],
            });

            const qEmbed = new EmbedBuilder()
                .setTitle(`PYTANIE: ${kategoria.toUpperCase()}`)
                .setDescription(`**${pytanie.p}**\n\nMasz **20 sekund** na odpowiedź!`)
                .setColor('#f39c12')
                .setFooter({ text: 'Powodzenia!' });

            const shuffledOptions = pytanie.o.sort(() => Math.random() - 0.5);
            const row = new ActionRowBuilder().addComponents(
                shuffledOptions.map(opt => 
                    new ButtonBuilder()
                        .setCustomId(opt === pytanie.pop ? 'q_correct' : `q_wrong_${Math.random()}`)
                        .setLabel(opt)
                        .setStyle(ButtonStyle.Primary)
                )
            );

            // Wysyłanie wiadomości z PINGIEM gracza
            await channel.send({ 
                content: `🔔 <@${interaction.user.id}> Twoje pytanie jest gotowe!`, 
                embeds: [qEmbed], 
                components: [row] 
            });
            
            // Informacja dla gracza w miejscu kliknięcia przycisku
            await interaction.reply({ content: `Twój kanał został stworzony: ${channel}`, ephemeral: true }).catch(() => {});

            // Kolektor ustawiony na 20 sekund (20000 ms)
            const collector = channel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 20000 });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) return;
                
                if (i.customId === 'q_correct') {
                    await i.update({ 
                        content: `✅ **POPRAWNIE!**\nGracz: <@${i.user.id}>\nWygrana: **${nagroda}**\n\n*Nagroda zostanie przyznana ręcznie przez administrację.*`, 
                        embeds: [], components: [] 
                    });
                } else {
                    await i.update({ 
                        content: `❌ **BŁĄD!**\nNiestety to nie ta odpowiedź. Poprawna to: **${pytanie.pop}**.`, 
                        embeds: [], components: [] 
                    });
                }
                collector.stop('done');
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    await channel.send("⏰ **KONIEC CZASU!** Nie udzielono odpowiedzi w ciągu 20 sekund.");
                }
                await channel.send("🏁 Kanał zostanie usunięty za 5 sekund...");
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            });

        } catch (e) {
            console.error("❌ Błąd:", e);
            await interaction.reply({ content: "Nie udało się stworzyć kanału. Sprawdź uprawnienia bota i ID kategorii.", ephemeral: true }).catch(() => {});
        }
    },

    async triggerManual(client) {
        await this.triggerEvent(client);
    }
};