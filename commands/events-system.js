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
                if (interaction.replied || interaction.deferred) return; 

                try {
                    await interaction.deferReply({ ephemeral: true });
                    const kategoria = interaction.customId.replace('event_join_', '');
                    await this.createPrivateQuestion(interaction, kategoria);
                } catch (e) {
                    console.error("❌ Błąd przycisku eventu:", e);
                }
            }
        });

        setInterval(async () => {
            const now = new Date();
            const h = now.getHours();
            const m = now.getMinutes();
            if (h >= 16 && h < 20 && (m === 0 || m === 30)) {
                if (Math.random() < 0.5) await this.triggerEvent(client);
            }
        }, 60000);
    },

    async triggerEvent(client) {
        try {
            const channelId = process.env.EVENT_CHANNEL_ID;
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel) return console.log("❌ Nie znaleziono kanału ogłoszeń.");

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
        } catch (e) { console.error(e); }
    },

    async createPrivateQuestion(interaction, kategoria) {
        const config = loadConfig();
        const pytaniaZKat = config.kategorie[kategoria];
        const pytanie = pytaniaZKat[Math.floor(Math.random() * pytaniaZKat.length)];
        const nagroda = config.nagrody[Math.floor(Math.random() * config.nagrody.length)];

        try {
            const categoryId = process.env.EVENT_CATEGORY_ID.trim();
            const guild = interaction.guild;

            const channel = await guild.channels.create({
                name: `event-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { 
                        id: interaction.user.id, 
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] 
                    }
                ],
            });

            await interaction.editReply({ content: `Kanał stworzony: ${channel}` });

            const qEmbed = new EmbedBuilder()
                .setTitle(`PYTANIE: ${kategoria.toUpperCase()}`)
                .setDescription(`**${pytanie.p}**\n\nMasz **20 sekund**!`)
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

            const m = await channel.send({ content: `🔔 <@${interaction.user.id}>`, embeds: [qEmbed], components: [row] });
            const collector = m.createMessageComponentCollector({ componentType: ComponentType.Button, time: 20000 });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) return;
                if (i.customId === 'q_correct') {
                    await i.update({ content: `✅ **DOBRZE!** Wygrana: **${nagroda}**`, embeds: [], components: [] });
                } else {
                    await i.update({ content: `❌ **ŹLE!** Poprawna: **${pytanie.pop}**`, embeds: [], components: [] });
                }
                collector.stop();
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') await channel.send("⏰ Koniec czasu.");
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            });

        } catch (e) {
            console.error("❌ BŁĄD TWORZENIA KANAŁU:", e);
            await interaction.editReply("Wystąpił błąd techniczny przy tworzeniu kanału.");
        }
    },

    async triggerManual(client) {
        await this.triggerEvent(client);
    }
};