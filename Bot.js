require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { loadCommands } = require('./command-loader.js');
const gra = require('./commands/gra.js');
// DODANO: Import systemu eventów
const eventSystem = require('./commands/events-system.js'); 

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

client.commands = new Collection();

// Uruchomienie ładowania komend
loadCommands(client);

// Obsługa interakcji
client.on('interactionCreate', async interaction => {
    try {
        // 1. OBSŁUGA KOMEND SLASH
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            await command.execute(interaction);
        }

        // 2. OBSŁUGA PRZYCISKÓW
        if (interaction.isButton()) {
            // Przekazujemy interakcję do modułu gry
            if (gra && gra.handleInteraction) {
                await gra.handleInteraction(interaction);
            } 
            
            // DODANO: Obsługa przycisków eventowych (np. "Zgłoś się!")
            // Jeśli przycisk należy do eventu, system go obsłuży
            if (interaction.customId.startsWith('event_join_')) {
                const kategoria = interaction.customId.replace('event_join_', '');
                await interaction.deferReply({ ephemeral: true });
                await eventSystem.createPrivateQuestion(interaction, kategoria);
            }
        }
    } catch (error) {
        console.error('🔴 Wystąpił błąd podczas interakcji:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Wystąpił błąd krytyczny bota!', ephemeral: true });
        }
    }
});

// Logowanie bota
client.login(process.env.DISCORD_TOKEN).then(() => {
    console.log(`
    ====================================
    🚀 BOT SYLWESTROWY JEST ONLINE!
    🤖 Zalogowano jako: ${client.user.tag}
    📅 Gotowy na odliczanie do 2026!
    ====================================
    `);

    // DODANO: Uruchomienie pętli czasowej eventów (16:00 - 20:00)
    eventSystem.init(client);
});