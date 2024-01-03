const fs = require('node:fs');
const path = require('node:path');
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, entersState, VoiceConnectionStatus, EndBehaviorType } = require('@discordjs/voice')
const { token, media_voice_folder } = require('./config.json');
const sqlutil = require('./utilities/sqlutil');
const { Console } = require('node:console');
const prism = require('prism-media')

sqlutil.buildPool()

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

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates] });

client.commands = new Collection();

var activeCalls = []

getAllFiles('.' + path.sep + 'commands', [])
	.filter(file => file.endsWith('.js'))
	.forEach(file => {
		const command = require(file);

		if ('enabled' in command && command.enabled && 'data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
			console.log(`[INFO] Loaded command at ${file}`);
		}
		else {
			console.log(`[WARNING] The command at ${file} is missing a required "data" or "execute" property or is not enabled.`);
		}
	});

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
		if (newState.member.id == client.user.id) {
			return //If the user is breadbot, ignore and exit
		}

		console.log(`\tChannel Join Detected ${newState.guild.id} - ${newState.channelId} - ${newState.member.id}`)

		var existingCallID = await sqlutil.inCall(newState.guild.id, newState.channelId)

		console.log(`\tExisting call ID ${existingCallID}`)

		if (existingCallID == -1) {
			console.log("\tJoining a call")

			var newCallID = await sqlutil.registerNewCall(newState.guild.id, newState.channelId, new Date())
			existingCallID = newCallID // To ensure all the stuff that happens after call creation works

			console.log(`\tNext call ID ${newCallID}`)

			// This should always have something to do, as all callIDs should be unique
			fs.mkdirSync(media_voice_folder + path.sep + newCallID, {recursive: true})

			const connection = joinVoiceChannel({
				channelId: newState.channelId,
				guildId: newState.guild.id,
				selfDeaf: false,
				selfMute: true,
				adapterCreator: newState.guild.voiceAdapterCreator
			})

			try {
				// What the hell does 20e3 mean, is that supposed to be sci notation?
				await entersState(connection, VoiceConnectionStatus.Ready, 20e3)
				const receiver = connection.receiver

				receiver.speaking.on("start", (user_id) => {
					receiver.subscribe(user_id, {
						end: {
							behavior: EndBehaviorType.AfterSilence,
							duration: 500
						}
					})
					.pipe(new prism.opus.OggLogicalBitstream({
						opusHead: new prism.opus.OpusHead({
							channelCount: 2,
							sampleRate: 48000
						}),
						pageSizeControl: {
							maxPackets: 10
						}
					}))
					.pipe(fs.createWriteStream(media_voice_folder + path.sep + newCallID + path.sep + `${Date.now()}-${user_id}.ogg`))

				})

				receiver.speaking.on("end", (user_id) => {
					console.log(`User ${user_id} stopped speaking`)
				})
			} catch (error) {
				console.warn(error)
			}
		}

		var userRegistered = await sqlutil.registerUserIfMissing(newState.member.id, newState.member.username, newState.member.displayName)

		if (userRegistered) {
			var markedUserInCall = await sqlutil.registerUserInCall(existingCallID, newState.member.id)

			if (!markedUserInCall) {
				console.log(`Something went wrong when marking user in voice call: ${newState.member.id} - ${newState.channelId}`)
			}
		} else {
			console.log(`Something went wrong when registering user for call: ${newState.member.id} - ${newState.member.username}`)
		}
	} else if (oldState.channel != null && newState.channel == null) {
		if (oldState.member.id == client.user.id) {
			return //If the user is breadbot, ignore and exit
		}

		console.log(`Channel Exit Detected ${oldState.guild.id} - ${oldState.channelId} - ${oldState.member.id}`)

		var existingCallID = await sqlutil.inCall(oldState.guild.id, oldState.channelId)

		console.log(`Existing call ID: ${existingCallID}`)

		if (existingCallID != -1) {
			await sqlutil.deregisterUserInCall(existingCallID, oldState.member.id)

			var usersInCall = await sqlutil.getNumberUsersInCall(existingCallID)

			if (usersInCall == 0) {
				const connection = getVoiceConnection(oldState.guild.id)
				connection.disconnect()

				var didUpdateEndTime = await sqlutil.updateCallEndTime(existingCallID, new Date())

				if (!didUpdateEndTime) {
					console.log(`Failed to mark call id ${existingCallID} as ended with an end date`)
				}
			}
		} else {
			console.log("Couldn't find a call ID based on the guild and channel info, was Breadbot in the call?")
		}
	}
})

client.on(Events.MessageCreate, async message => {
	console.log("Message Create Fired")

	var channel_ok = await sqlutil.registerChannelIfMissing(message.channelId, message.channel.guild.id, message.channel.name)
	var user_ok = await sqlutil.registerUserIfMissing(message.author.id, message.author.username, message.author.displayName)

	console.log(`Channel OK? ${channel_ok}`)
	console.log(`User OK? ${user_ok}`)

	if (channel_ok && user_ok) {
		await sqlutil.registerMessage(message.id, message.channelId, message.author.id, message.content, message.createdAt).then(async message_add => {
			if(message_add) {
				console.log("Message Added")

				if (message.attachments.size != 0) {
					const all_attachments = message.attachments.map(attachment => sqlutil.registerAttachmentIfMissing(
						attachment.id,
						message.id,
						attachment.name,
						attachment.description,
						message.createdAt,
						attachment.contentType,
						attachment.url
					))
			
					await Promise.all(all_attachments).catch((error) => {
						console.log(error)
					})
				}
			} else {
				console.log("Failed to log message")
			}
		})
	}
})

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
	console.log("Message Update Fired")
	console.log(`Old Message Snowflake: ${oldMessage.id}`)
	console.log(`New Message Snowflake: ${newMessage.id}`)

	var editTime = newMessage.editedAt

	if (editTime == null) {
		editTime = newMessage.createdAt
	}
	
	await sqlutil.updateMessageContentIfPresent(newMessage.id, newMessage.content, editTime).then(async (updated) => {
		if (updated) {
			if (newMessage.attachments.size != 0) {
				const all_attachments = newMessage.attachments.map(attachment => sqlutil.registerAttachmentIfMissing(
					attachment.id,
					newMessage.id,
					attachment.name,
					attachment.description,
					editTime,
					attachment.contentType,
					attachment.url
				))
		
				await Promise.all(all_attachments).catch((error) => {
					console.log(error)
				})
			}
		}
	})
})

client.on(Events.MessageDelete, async deletedMessage => {
	await sqlutil.markMessageDeletedIfPresent(deletedMessage.id)
})

client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag} - ${c.user.id}`);
});

client.login(token);