const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');
const fs = require('node:fs');
const path = require('node:path');

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

const commands = [];
const allFiles = [];
getAllFiles('.' + path.sep + 'commands', allFiles);
allFiles.forEach(file => {
	console.log(file);
});
// Grab all the command files from the commands directory you created earlier
const commandFiles = allFiles.filter(file => file.endsWith('.js'));

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
	const command = require(`${file}`);
	if ('enabled' in command && command.enabled && 'data' in command && 'execute' in command) {
		commands.push(command.data.toJSON());
	}
	else {
		console.log(`Skipping ${file} as it is missing one or more required exported fields`);
	}
}

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(token);

// and deploy your commands!
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	}
	catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();