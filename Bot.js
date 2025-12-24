require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { loadCommands } = require('./command-loader.js'); // Poprawny import z destrukturyzacją
const gra = require('./commands/gra.js'); // Importujemy logikę przycisków

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

client.commands = new Collection();

// Ładowanie komend i rejestracja w Discordzie
loadCommands(client);

client.on('interactionCreate', async interaction => {
    // Obsługa komend Slash (/gra, /ranking, /zrzut)
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Wystąpił błąd podczas wykonywania komendy!', ephemeral: true });
        }
    }

    // Obsługa wszystkich przycisków gry (Sklep, Klikanie, Prestiż, Zrzut)
    if (interaction.isButton()) {
        try {
            await gra.handleInteraction(interaction);
        } catch (error) {
            console.error('Błąd przycisku:', error);
        }
    }
});

client.login(process.env.DISCORD_TOKEN).then(() => {
    console.log(`✅ Bot sylwestrowy zalogowany jako ${client.user.tag}!`);
});