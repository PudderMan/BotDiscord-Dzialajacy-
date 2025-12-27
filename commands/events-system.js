const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const loadConfig = () => {
    try {
        const filePath = path.join(__dirname, 'configpytan.json');
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        console.error("❌ BŁĄD JSON:", err);
        return null;
    }
};

module.exports = {
    init(client) {
        console.log("🚀 System Eventów: Słuchacz aktywny.");
        
        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isButton()) return;
            
            if (interaction.customId.startsWith('event_join_')) {
                try {
                    const disabledRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('event_busy')
                            .setLabel('Zajęte!')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );
                    
                    await interaction.update({ components: [disabledRow] });
                    
                    const kategoria = interaction.customId.replace('event_join_', '');
                    await this.createPrivateQuestion(interaction, kategoria);
                } catch (e) {
                    if (e.code !== 10062 && e.code !== 40060) {
                        console.error("❌ Błąd przycisku eventu:", e);
                    }
                }
            }
        });

        setInterval(async () => {
            // Pobieramy czas wymuszając strefę czasową Warszawy
            const polandTime = new Date().toLocaleString("en-US", { timeZone: "Europe/Warsaw" });
            const now = new Date(polandTime);
            
            const h = now.getHours();
            const m = now.getMinutes();

            // Teraz możesz wpisać polskie godziny bezpośrednio (16:00 - 20:00)
            if (h >= 16 && h < 20 && (m === 0 || m === 30)) {
                if (Math.random() < 0.5) {
                    await this.triggerEvent(client);
                }
            }
        }, 60000);
    },

    async triggerEvent(client) {
        try {
            const channelId = process.env.EVENT_CHANNEL_ID;
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel) return;

            const config = loadConfig();
            const kats = Object.keys(config.kategorie);
            const wybranakat = kats[Math.floor(Math.random() * kats.length)];

            const eventMessage = `Pytanie \`${wybranakat.toUpperCase()}\``;

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`event_join_${wybranakat}`)
                    .setLabel('Zgłoś się!')
                    .setStyle(ButtonStyle.Success)
            );

            await channel.send({ content: eventMessage, components: [row] });
        } catch (e) { console.error(e); }
    },

    async createPrivateQuestion(interaction, kategoria) {
        const config = loadConfig();
        const pytaniaZKat = config.kategorie[kategoria];
        const pytanie = pytaniaZKat[Math.floor(Math.random() * pytaniaZKat.length)];
        const nagroda = config.nagrody[Math.floor(Math.random() * config.nagrody.length)];

        try {
            const categoryId = process.env.EVENT_CATEGORY_ID.trim();
            
            const channel = await interaction.guild.channels.create({
                name: `event-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                ],
            });

            await interaction.followUp({ content: `✅ Twój kanał został stworzony: ${channel}`, ephemeral: true });

            const qEmbed = new EmbedBuilder()
                .setTitle(`PYTANIE: ${kategoria.toUpperCase()}`)
                .setDescription(`**${pytanie.p}**\n\nMasz **20 sekund**!`)
                .setColor('#f39c12');

            const row = new ActionRowBuilder().addComponents(
                pytanie.o.sort(() => Math.random() - 0.5).map(opt => 
                    new ButtonBuilder()
                        .setCustomId(opt === pytanie.pop ? 'q_correct' : `q_wrong_${Math.random()}`)
                        .setLabel(opt)
                        .setStyle(ButtonStyle.Primary)
                )
            );

            const m = await channel.send({ content: `🔔 <@${interaction.user.id}>`, embeds: [qEmbed], components: [row] });
            const collector = m.createMessageComponentCollector({ componentType: ComponentType.Button, time: 20000 });

            let answeredCorrectly = false;

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) return;
                
                if (i.customId === 'q_correct') {
                    answeredCorrectly = true;
                    // Usunięto dopisek o administracji
                    await i.update({ 
                        content: `✅ **DOBRZE!** Wygrana: **${nagroda}**`, 
                        embeds: [], 
                        components: [] 
                    });
                    collector.stop('correct');
                } else {
                    await i.update({ 
                        content: `❌ **ŹLE!** Poprawna odpowiedź: **${pytanie.pop}**\n*Kanał zostanie usunięty za 5 sekund.*`, 
                        embeds: [], 
                        components: [] 
                    });
                    collector.stop('wrong');
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    await channel.send("⏰ Koniec czasu na odpowiedź. Kanał zostanie usunięty za 5 sekund.");
                    setTimeout(() => channel.delete().catch(() => {}), 5000);
                } else if (reason === 'wrong') {
                    setTimeout(() => channel.delete().catch(() => {}), 5000);
                }
                // Jeśli reason === 'correct', nic nie robimy - kanał zostaje.
            });

        } catch (e) {
            console.error("❌ BŁĄD TWORZENIA KANAŁU:", e);
        }
    },

    async triggerManual(client) {
        await this.triggerEvent(client);
    }
};