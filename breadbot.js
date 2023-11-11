const fs = require('node:fs');
const path = require('node:path');
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const { token, mysql_username, mysql_password } = require('./config.json');
const sqlutil = require('./utilities/sqlutil')

sqlutil.buildPool('breadbot_test')

const getAllFiles = function(directoryPath, arrayOfFiles) {
	const files = fs.readdirSync(directoryPath);

	arrayOfFiles = arrayOfFiles || [];

	files.forEach(file => {
		if (fs.statSync(directoryPath + path.sep + file).isDirectory()) {
			arrayOfFiles = getAllFiles(directoryPath + path.sep + file, arrayOfFiles);
		}
		else {
			arrayOfFiles.push(path.join(__dirname, directoryPath, path.sep, file));
		}
	});

	return arrayOfFiles;
};

const allFiles = [];
getAllFiles('.' + path.sep + 'commands', allFiles);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

const commandFiles = allFiles.filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(file);

	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
		console.log(`[INFO] Loaded command at ${file}`);
	}
	else {
		console.log(`[WARNING] The command at ${file} is missing a required "data" or "execute" property.`);
	}
}

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	}
	catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

client.on(Events.GuildCreate, async guild => {
	if (guild.available) {
		console.log('Got into a server')
		console.log(`The server name is ${guild.name}`)
		console.log(`The server description is ${guild.description}`)
		console.log(`The server snowflake is ${guild.id}`)

		if (!sqlutil.isServerRegistered(guild.id)) {
			console.log("Server is not registered")

			if (sqlutil.registerServer(guild.id, guild.name, guild.description)) {
				console.log("Server Registered")
			} else {
				console.log("Failed to register the server")
			}
		} else {
			console.log("Server is already registered")
		}
	}
})

client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.login(token);