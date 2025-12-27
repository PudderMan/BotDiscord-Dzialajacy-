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

const eventsSystem = {
    async triggerEvent(client) {
        console.log("[LOG] Uruchamianie triggerEvent...");
        try {
            const channelId = process.env.EVENT_CHANNEL_ID;
            const channel = await client.channels.fetch(channelId).catch(() => null);
            
            if (!channel) {
                console.log("❌ Nie znaleziono kanału o ID:", channelId);
                return;
            }

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

            await channel.send({ embeds: [embed], components: [row] });
            console.log("✅ Wiadomość eventowa wysłana!");
        } catch (error) {
            console.error("❌ Błąd w triggerEvent:", error);
        }
    },

    async createPrivateQuestion(interaction, kategoria) {
        console.log(`[LOG] Tworzenie pytania dla ${interaction.user.tag}`);
        const config = loadConfig();
        const pytaniaZKat = config.kategorie[kategoria];
        const pytanie = pytaniaZKat[Math.floor(Math.random() * pytaniaZKat.length)];
        const nagroda = config.nagrody[Math.floor(Math.random() * config.nagrody.length)];

        try {
            const categoryId = process.env.EVENT_CATEGORY_ID;

            const channel = await interaction.guild.channels.create({
                name: `event-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                ],
            });

            const qEmbed = new EmbedBuilder()
                .setTitle(`PYTANIE: ${kategoria.toUpperCase()}`)
                .setDescription(`**${pytanie.p}**\n\nMasz **20 sekund** na odpowiedź!`)
                .setColor('#f39c12');

            const shuffledOptions = pytanie.o.sort(() => Math.random() - 0.5);
            const row = new ActionRowBuilder().addComponents(
                shuffledOptions.map(opt => 
                    new ButtonBuilder()
                        .setCustomId(opt === pytanie.pop ? 'q_correct' : `q_wrong_${Math.random()}`)
                        .setLabel(opt)
                        .setStyle(ButtonStyle.Primary)
                )
            );

            await channel.send({ content: `🔔 <@${interaction.user.id}> Twoje pytanie!`, embeds: [qEmbed], components: [row] });
            await interaction.editReply({ content: `Kanał został stworzony: ${channel}` });

            const collector = channel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 20000 });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) return;
                if (i.customId === 'q_correct') {
                    await i.update({ content: `✅ **POPRAWNIE!**\nWygrana: **${nagroda}**\nNagroda do dodania ręcznie.`, embeds: [], components: [] });
                } else {
                    await i.update({ content: `❌ **BŁĄD!**\nPoprawna odpowiedź: **${pytanie.pop}**.`, embeds: [], components: [] });
                }
                collector.stop();
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') await channel.send("⏰ Koniec czasu!");
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            });

        } catch (e) {
            console.error("❌ Błąd przy tworzeniu kanału:", e);
            await interaction.editReply("Błąd podczas tworzenia kanału.");
        }
    }
};

// WAŻNE: Eksportujemy obiekt, żeby inne pliki mogły go używać
module.exports = eventsSystem;