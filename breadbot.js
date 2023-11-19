const fs = require('node:fs');
const path = require('node:path');
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const { token, mysql_username, mysql_password } = require('./config.json');
const sqlutil = require('./utilities/sqlutil');
const { Console } = require('node:console');

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

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates] });

client.commands = new Collection();

const commandFiles = allFiles.filter(file => file.endsWith('.js'));

var activeCalls = []

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

		sqlutil.registerServerIfMissing(guild.id, guild.name, guild.description).then(server_added => {
			if(server_added) {
				console.log(`Server Added ${guild.name}`)
			} else {
				console.log(`Server failed to add ${guild.name}`)
			}
		})
	}
})

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
	console.log("Voice State Update Fired")

	if (oldState.channel == null && newState.channel != null) {
		console.log(`\tChannel Join Detected ${newState.guild.id} - ${newState.channelId} - ${newState.user.id}`)

		var existingCallID = await sqlutil.inCall(newState.guild.id, newState.channelId)

		console.log(`\tExisting call ID ${existingCallID}`)

		if (existingCallID == -1) {
			console.log("\tJoining a call")

			var newCallID = await sqlutil.registerNewCall(newState.guild.id, newState.channelId, new Date())

			console.log(`\tNext call ID ${newCallID}`)

			// This should always have something to do, as all callIDs should be unique
			fs.mkdirSync("." + path.sep + "media" + path.sep + "voice_audio" + path.sep + newCallID, {recursive: true})

			connection = newState.channel.join().then(conn => {
				const receiver = conn.receiver

				conn.on("speaking", (user, speaking) => {
					if (speaking) {
						console.log(`User is speaking ${user.username}`)

						const audioStream = receiver.createStream(user, { mode: "pcm"})

						const pathToFile = "." + path.sep + "media" + path.sep + "voice_audio" + path.sep + newCallID + `${user.id}-${Date.now()}.pcm`

						audioStream.pipe(fs.createWriteStream(pathToFile))
						audioStream.on("end", () => {
							console.log(`User stopped speaking ${user.username}`)
						})
					}
				})
			}).catch(error => {
				console.log(error)
			})
		}
	} else if (oldState.channel != null && newState.channel == null ) {

	}
	/*if (oldState.channel== null && newState.channel != null) {
		console.log(`User ${newState.member.user.username} joined channel ${newState.channel.name} in guild ${newState.guild.name}`)

		var last_voice_active_users = await sqlutil.getVoiceActiveUsers(newState.guild.id, newState.channelId)

		var did_update = await sqlutil.updateVoiceActiveUsers(newState.guild.id, newState.channelId, true)

		if (did_update) {
			console.log("\t Registered another user as participating in this voice channel")
		} else {
			console.log("\t Failed to register this user as participating in this voice channel")
		}

		var voice_active_users = await sqlutil.getVoiceActiveUsers(newState.guild.id, newState.channelId)

		if (last_voice_active_users <= 0 && voice_active_users > 0) {
			console.log("New call detected, getting set up")
			var new_call_id = await sqlutil.registerNewCall(newState.guild.id, newState.channelId, new Date())

			if (new_call_id != -1) {
				console.log("New call successfully registered")
				activeCalls[newState.guild.id.concat("|", newState.channelId)] = new_call_id

				// Setup call connection for BreadBot and configure events here
			} else {
				console.log("Failed to generate a new call ID")
			}
		}
	} else if (oldState.channel != null && newState.channel == null) {
		console.log(`User ${oldState.member.user.username} left channel ${oldState.channel.name} in guild ${oldState.guild.name}`)

		var last_voice_active_users = await sqlutil.getVoiceActiveUsers(oldState.guild.id, oldState.channelId)

		var did_update = await sqlutil.updateVoiceActiveUsers(oldState.guild.id, oldState.channelId, false)

		if (did_update) {
			console.log("\t Removed registered user as participating in this voice channel")
		} else {
			console.log("\t Failed to remove registered user as participating in this voice channel")
		}

		var voice_active_users = await sqlutil.getVoiceActiveUsers(oldState.guild.id, oldState.channelId)

		if (last_voice_active_users > 0 && voice_active_users <= 0) {
			console.log("End of call detected, tearing down")
			var end_time_set = await sqlutil.updateCallEndTime(activeCalls[oldState.guild.id.concat("|", oldState.channelId)], new Date())

			if (end_time_set) {
				console.log("Call is ending, disconnecting BreadBot")

				// Disconnect BreadBot and end connection here

				delete activeCalls[oldState.guild.id.concat("|", oldState.channelId)]
			} else {
				console.log("Failed to properly set the end time of the call")
			}
		}
	}*/
})

client.on(Events.MessageCreate, async message => {
	console.log("Message Create Fired")

	var channel_ok = await sqlutil.registerChannelIfMissing(message.channelId, message.channel.guild.id, message.channel.name)
	var user_ok = await sqlutil.registerUserIfMissing(message.author.id, message.author.username, message.author.displayName)

	console.log(`Channel OK? ${channel_ok}`)
	console.log(`User OK? ${user_ok}`)

	if (channel_ok && user_ok) {
		sqlutil.registerMessage(message.id, message.channelId, message.author.id, message.content, message.createdAt).then(message_add => {
			if(message_add) {
				console.log("Message Added")
			} else {
				console.log("Failed to log message")
			}
		})
	}
})

client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.login(token);