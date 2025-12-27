const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ComponentType } = require('discord.js');
const fs = require('fs');

const loadConfig = () => JSON.parse(fs.readFileSync('./configpytan.json', 'utf8'));

module.exports = {
    init(client) {
        console.log("✅ System Eventów (16-20) Aktywny. Nagrody przyznawane RĘCZNIE.");
        
        setInterval(async () => {
            const now = new Date();
            const h = now.getHours();
            const m = now.getMinutes();

            if (h >= 16 && h < 20 && (m === 0 || m === 30)) {
                if (Math.random() < 0.5) {
                    await this.triggerEvent(client);
                }
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
        const channel = await client.channels.fetch(process.env.EVENT_CHANNEL_ID);
        if (!channel) return;

        const config = loadConfig();
        const kats = Object.keys(config.kategorie);
        const wybranakat = kats[Math.floor(Math.random() * kats.length)];

        const embed = new EmbedBuilder()
            .setTitle(`🔔 KONKURS: ${wybranakat.toUpperCase()}`)
            .setDescription(`Pojawiło się pytanie! Pierwsza osoba klika i odpowiada.\nKategoria: **${wybranakat}**`)
            .setColor('#27ae60');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`event_join_${wybranakat}`).setLabel('Zgłoś się! 🙋‍♂️').setStyle(ButtonStyle.Success)
        );

        const msg = await channel.send({ embeds: [embed], components: [row] });

        const collector = msg.createMessageComponentCollector({ max: 1, time: 55000 });
        collector.on('collect', async (i) => {
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('x').setLabel('Zajęte!').setStyle(ButtonStyle.Secondary).setDisabled(true)
            );
            await i.update({ components: [disabledRow] });
        });
    },

    async createPrivateQuestion(interaction, kategoria) {
        const config = loadConfig();
        const pytaniaZKat = config.kategorie[kategoria];
        const pytanie = pytaniaZKat[Math.floor(Math.random() * pytaniaZKat.length)];
        const nagroda = config.nagrody[Math.floor(Math.random() * config.nagrody.length)];

        try {
            const channel = await interaction.guild.channels.create({
                name: `${interaction.user.username}-${kategoria}`,
                parent: process.env.EVENT_CATEGORY_ID,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ],
            });

            const qEmbed = new EmbedBuilder()
                .setTitle(`PYTANIE: ${kategoria.toUpperCase()}`)
                .setDescription(`**${pytanie.p}**\n\nMasz **10 sekund** na odpowiedź!`)
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

            const m = await channel.send({ content: `<@${interaction.user.id}>`, embeds: [qEmbed], components: [row] });

            const collector = m.createMessageComponentCollector({ componentType: ComponentType.Button, time: 10000 });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) return i.reply({ content: "To nie Twoje pytanie!", ephemeral: true });

                if (i.customId === 'q_correct') {
                    // TYLKO INFORMACJA - BRAK MODYFIKACJI BAZY DANYCH
                    await i.update({ 
                        content: `✅ **POPRAWNIE!**\nGracz: <@${i.user.id}>\nWygrana: **${nagroda}**\n\n*Nagroda zostanie przyznana ręcznie przez administrację.*`, 
                        embeds: [], 
                        components: [] 
                    });
                } else {
                    await i.update({ 
                        content: `❌ **BŁĄD!**\nNiestety to zła odpowiedź. Poprawna to: **${pytanie.pop}**.`, 
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
            console.error("Błąd eventu:", e);
        }
    },

    async triggerManual(client) {
        await this.triggerEvent(client);
    }
};