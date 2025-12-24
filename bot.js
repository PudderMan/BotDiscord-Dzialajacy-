require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { loadCommands } = require('./command-loader.js');
const fs = require('fs');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

client.commands = new Collection();

// 1. Odpalamy loader komend
loadCommands(client);

// 2. Obsługa interakcji (przekierowanie do plików komend)
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
    }

    // Przekierowanie przycisków do pliku gry
    if (interaction.isButton()) {
        const gameCommand = client.commands.get('gra'); // Szukamy logiki w gra.js
        if (gameCommand && gameCommand.handleInteraction) {
            await gameCommand.handleInteraction(interaction);
        }
    }
});

client.login(process.env.DISCORD_TOKEN).then(() => {
    console.log(`✅ Bot sylwestrowy gotowy!`);
});