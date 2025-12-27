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
        console.log("✅ System Eventów zainicjowany.");
        
        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isButton()) return;
            if (interaction.customId.startsWith('event_join_')) {
                console.log(`[STEP 1] Kliknięto przycisk przez: ${interaction.user.tag}`);
                const kategoria = interaction.customId.replace('event_join_', '');
                
                try {
                    await interaction.deferReply({ ephemeral: true });
                    console.log("[STEP 2] DeferReply wysłane.");
                    await this.createPrivateQuestion(interaction, kategoria);
                } catch (e) {
                    console.error("❌ Błąd interakcji:", e);
                }
            }
        });
    },

    async createPrivateQuestion(interaction, kategoria) {
        console.log("[STEP 3] Start createPrivateQuestion");
        const config = loadConfig();
        if (!config) return console.log("❌ Brak configu!");

        const pytaniaZKat = config.kategorie[kategoria];
        const pytanie = pytaniaZKat[Math.floor(Math.random() * pytaniaZKat.length)];
        const nagroda = config.nagrody[Math.floor(Math.random() * config.nagrody.length)];

        try {
            const guild = interaction.guild;
            // Sprawdzamy czy zmienna w ogóle istnieje
            const categoryId = process.env.EVENT_CATEGORY_ID ? process.env.EVENT_CATEGORY_ID.trim() : null;
            
            console.log(`[STEP 4] Próba użycia kategorii ID: ${categoryId}`);

            if (!categoryId) {
                console.log("❌ BŁĄD: Zmienna EVENT_CATEGORY_ID jest pusta w .env!");
                return await interaction.editReply("Błąd konfiguracji bota (brak ID kategorii).");
            }

            const channel = await guild.channels.create({
                name: `event-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { 
                        id: interaction.user.id, 
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] 
                    },
                    {
                        id: guild.members.me.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
                    }
                ],
            });

            console.log(`[STEP 5] Kanał stworzony pomyślnie: ${channel.name}`);

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

            await channel.send({ content: `🔔 <@${interaction.user.id}>`, embeds: [qEmbed], components: [row] });
            await interaction.editReply({ content: `Kanał gotowy: ${channel}` });

            const collector = channel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 20000 });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) return;
                if (i.customId === 'q_correct') {
                    await i.update({ content: `✅ **POPRAWNIE!** Nagroda: **${nagroda}**`, embeds: [], components: [] });
                } else {
                    await i.update({ content: `❌ **BŁĄD!** Poprawna: **${pytanie.pop}**`, embeds: [], components: [] });
                }
                collector.stop();
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') await channel.send("⏰ Koniec czasu.");
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            });

        } catch (e) {
            console.log("❌ [KROK KRYTYCZNY] Błąd przy tworzeniu kanału:");
            console.error(e);
            await interaction.editReply("Wystąpił błąd podczas tworzenia kanału.");
        }
    },

    async triggerEvent(client) {
        // ... (kod triggerEvent bez zmian, jak wcześniej) ...
    },

    async triggerManual(client) {
        await this.triggerEvent(client);
    }
};