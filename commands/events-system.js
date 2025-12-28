const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Bezpieczne ładowanie configu
const loadConfig = () => {
    try {
        const filePath = path.join(__dirname, 'configpytan.json');
        if (!fs.existsSync(filePath)) return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        console.error("❌ [EventSystem] Błąd ładowania configpytan.json:", err);
        return null;
    }
};

module.exports = {
    init(client) {
        console.log("🚀 [EventSystem] Moduł załadowany i gotowy.");
        
        // --- OBSŁUGA INTERAKCJI (JOIN) ---
        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isButton()) return;
            if (!interaction.customId.startsWith('event_join_')) return;

            try {
                // 1. ZABEZPIECZENIE PRZED DOUBLE-CLICK
                if (interaction.replied || interaction.deferred) return;

                // 2. NATYCHMIASTOWE ODROCZENIE (Zapobiega Unknown Interaction)
                await interaction.deferUpdate();

                // 3. BLOKADA PRZYCISKU (Wizualna informacja dla graczy)
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('event_busy')
                        .setLabel('Przetwarzanie...')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
                
                // Używamy editReply, bo zrobiliśmy już deferUpdate
                await interaction.editReply({ components: [disabledRow] }).catch(() => null);

                // 4. LOGIKA BIZNESOWA
                const kategoria = interaction.customId.replace('event_join_', '');
                await this.createPrivateQuestion(interaction, kategoria);

            } catch (e) {
                // Ignorujemy błędy API wynikające z usunięcia wiadomości w międzyczasie
                if (e.code !== 10008 && e.code !== 10062) {
                    console.error("❌ [EventSystem] Krytyczny błąd join:", e);
                }
            }
        });

        // --- TIMER (Sprawdzanie godziny) ---
        setInterval(async () => {
            try {
                const polandTime = new Date().toLocaleString("en-US", { timeZone: "Europe/Warsaw" });
                const now = new Date(polandTime);
                const h = now.getHours();
                const m = now.getMinutes();

                // Godziny: 16:00 - 19:59, co 30 minut (00 i 30)
                if (h >= 16 && h < 20 && (m === 0 || m === 30)) {
                    // 50% szans na event
                    if (Math.random() < 0.5) {
                        await this.triggerEvent(client);
                    }
                }
            } catch (error) {
                console.error("❌ [EventSystem] Błąd w pętli czasowej:", error);
            }
        }, 60000); // Sprawdzaj co minutę
    },

    // --- ROZPOCZĘCIE EVENTU PUBLICZNEGO ---
    async triggerEvent(client) {
        try {
            const channelId = process.env.EVENT_CHANNEL_ID;
            if (!channelId) return console.warn("⚠️ Brak EVENT_CHANNEL_ID w .env");

            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel) return;

            const config = loadConfig();
            if (!config || !config.kategorie) return;

            const kats = Object.keys(config.kategorie);
            if (kats.length === 0) return;
            const wybranakat = kats[Math.floor(Math.random() * kats.length)];

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`event_join_${wybranakat}`)
                    .setLabel('Zgłoś się!')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎉')
            );

            await channel.send({ 
                content: `📢 **SZYBKI EVENT!**\nKategoria: \`${wybranakat.toUpperCase()}\`\nKto pierwszy ten lepszy!`, 
                components: [row] 
            });

        } catch (e) { 
            console.error("❌ [EventSystem] Błąd triggerEvent:", e); 
        }
    },

    // --- TWORZENIE PRYWATNEGO KANAŁU ---
    async createPrivateQuestion(interaction, kategoria) {
        const config = loadConfig();
        const pytaniaZKat = config.kategorie[kategoria];
        
        if (!pytaniaZKat) return; // Zabezpieczenie gdyby kategoria zniknęła z configu

        const pytanie = pytaniaZKat[Math.floor(Math.random() * pytaniaZKat.length)];
        const nagroda = config.nagrody[Math.floor(Math.random() * config.nagrody.length)];

        let channel = null;

        try {
            const categoryId = process.env.EVENT_CATEGORY_ID ? process.env.EVENT_CATEGORY_ID.trim() : null;
            
            // Tworzenie kanału
            channel = await interaction.guild.channels.create({
                name: `event-${interaction.user.username.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`, // Sanitizacja nazwy
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ],
            });

            // Informacja dla użytkownika (Ephemeral FollowUp)
            await interaction.followUp({ 
                content: `✅ Stworzono kanał eventowy: ${channel.toString()}! Pobiegnij tam szybko!`, 
                ephemeral: true 
            }).catch(() => null);

            // Przygotowanie pytania
            const qEmbed = new EmbedBuilder()
                .setTitle(`🧠 PYTANIE: ${kategoria.toUpperCase()}`)
                .setDescription(`**${pytanie.p}**\n\n⏳ Masz **20 sekund** na odpowiedź!`)
                .setColor('#f1c40f')
                .setFooter({ text: 'System Eventowy' });

            // Mieszanie odpowiedzi (Algorytm Fisher-Yates byłby lepszy, ale sort random wystarczy tutaj)
            const options = [...pytanie.o].sort(() => Math.random() - 0.5);

            const row = new ActionRowBuilder().addComponents(
                options.map((opt, index) => 
                    new ButtonBuilder()
                        .setCustomId(opt === pytanie.pop ? 'q_correct' : `q_wrong_${index}`) // Index unika duplikatów ID
                        .setLabel(opt.substring(0, 80)) // Zabezpieczenie przed za długim tekstem
                        .setStyle(ButtonStyle.Primary)
                )
            );

            const msg = await channel.send({ 
                content: `🔔 <@${interaction.user.id}>`, 
                embeds: [qEmbed], 
                components: [row] 
            });

            // --- KOLEKTOR ODPOWIEDZI ---
            const collector = msg.createMessageComponentCollector({ 
                componentType: ComponentType.Button, 
                time: 20000 
            });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: "To nie Twój event!", ephemeral: true });
                }

                try {
                    // Zabezpieczenie interakcji w kanale
                    if (!i.deferred && !i.replied) await i.deferUpdate();

                    if (i.customId === 'q_correct') {
                        // === WYGRANA ===
                        const winEmbed = new EmbedBuilder()
                            .setTitle('🎉 GRATULACJE!')
                            .setDescription(`Poprawna odpowiedź!\n\n💎 Wygrana: **${nagroda}**`)
                            .setColor('#2ecc71');

                        await i.editReply({ embeds: [winEmbed], components: [] }).catch(() => null);
                        
                        // TUTAJ MOŻESZ DODAĆ UPDATE BAZY DANYCH:
                        // db.prepare('UPDATE players SET diamonds = diamonds + ? WHERE userId = ?').run(parseInt(nagroda), i.user.id);

                        collector.stop('correct');
                    } else {
                        // === PRZEGRANA ===
                        const loseEmbed = new EmbedBuilder()
                            .setTitle('❌ BŁĄD!')
                            .setDescription(`Poprawna odpowiedź to: **${pytanie.pop}**\n\nKanał zostanie usunięty za 5 sekund.`)
                            .setColor('#e74c3c');

                        await i.editReply({ embeds: [loseEmbed], components: [] }).catch(() => null);
                        collector.stop('wrong');
                    }
                } catch (err) {
                    console.error("Błąd w trakcie collect:", err);
                }
            });

            collector.on('end', async (_, reason) => {
                // Usuwanie kanału niezależnie czy czas minął, czy błędna odpowiedź (oprócz wygranej jeśli chcesz zachować kanał)
                // W Twojej logice: wygrana zostawia kanał, reszta usuwa.
                
                if (reason === 'time') {
                    await channel.send("⏰ Czas minął! Kanał zostanie usunięty.").catch(() => null);
                    setTimeout(() => channel.delete().catch(() => null), 5000);
                } else if (reason === 'wrong') {
                    setTimeout(() => channel.delete().catch(() => null), 5000);
                }
                // 'correct' - kanał zostaje (wg Twojego życzenia)
            });

        } catch (e) {
            console.error("❌ [EventSystem] Błąd tworzenia pytania:", e);
            // Jeśli kanał powstał, ale coś wybuchło - posprzątaj
            if (channel) setTimeout(() => channel.delete().catch(() => null), 5000);
        }
    },

    // Helper do testów
    async triggerManual(client) {
        await this.triggerEvent(client);
    }
};