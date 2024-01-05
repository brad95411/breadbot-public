const fs = require('node:fs');
const path = require('node:path');
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, entersState, VoiceConnectionStatus, EndBehaviorType } = require('@discordjs/voice')
const { token, media_voice_folder, breadbot_logging_config } = require('./config.json');
const winston = require('winston')
const winston_mysql = require('winston-mysql')
const sqlutil = require('./utilities/sqlutil');
const { Console } = require('node:console');
const prism = require('prism-media')

const logger = winston.createLogger({
	level: "silly",
	transports: [
		new winston.transports.Console({
			format: winston.format.simple(),
			level: breadbot_logging_config["console_log_level"]
		}),
		new winston_mysql({
			level: breadbot_logging_config["sql_log_level"],
			host: breadbot_logging_config["mysql_host"],
			user: breadbot_logging_config["mysql_username"],
			password: breadbot_logging_config["mysql_password"],
			database: breadbot_logging_config["mysql_db_name"],
			table: breadbot_logging_config["mysql_table_name"]
		})
	]
})

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
			logger.info(`Loaded command at ${file}`)
		}
		else {
			logger.warn(`The command at ${file} is missing a required "data" or "execute" property or is not enabled`)
		}
	});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		logger.error(`No command matching ${interaction.commandName} was found`)
		return;
	}

	try {
		await command.execute(interaction);
	}
	catch (error) {
		logger.error(error)
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});

client.on(Events.GuildCreate, async guild => {
	if (guild.available) {
		logger.info(`Got into a server, ${guild.name}, ${guild.id}, ${guild.description}`)

		sqlutil.registerServerIfMissing(guild.id, guild.name, guild.description).then(server_added => {
			if(server_added) {
				logger.info(`Server Added ${guild.name}`)
			} else {
				logger.error(`Server failed to add ${guild.name}`)
			}
		})
	}
})

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
	logger.info("Voice State Update Fired")

	if (oldState.channel == null && newState.channel != null) {
		if (newState.member.id == client.user.id) {
			return //If the user is breadbot, ignore and exit
		}

		logger.info(`Channel Join Detected ${newState.guild.id} - ${newState.channelId} - ${newState.member.id}`)

		var existingCallID = await sqlutil.inCall(newState.guild.id, newState.channelId)

		logger.info(`Existing call ID ${existingCallID}`)

		if (existingCallID == -1) {
			logger.info("Joining a call")

			var newCallID = await sqlutil.registerNewCall(newState.guild.id, newState.channelId, new Date())
			existingCallID = newCallID // To ensure all the stuff that happens after call creation works

			logger.info(`Next call ID ${newCallID}`)

			fs.mkdirSync(media_voice_folder + path.sep + newCallID, {recursive: true})

			const connection = joinVoiceChannel({
				channelId: newState.channelId,
				guildId: newState.guild.id,
				selfDeaf: false,
				selfMute: true,
				adapterCreator: newState.guild.voiceAdapterCreator
			})

			try {
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
					logger.info(`User ${user_id} stopped speaking`)
				})
			} catch (error) {
				logger.error(error)
			}
		}

		var userRegistered = await sqlutil.registerUserIfMissing(newState.member.id, newState.member.username, newState.member.displayName)

		if (userRegistered) {
			var markedUserInCall = await sqlutil.registerUserInCall(existingCallID, newState.member.id)

			if (!markedUserInCall) {
				logger.error(`Something went wrong when marking user in voice call: ${newState.member.id} - ${newState.channelId}`)
			}
		} else {
			logger.error(`Something went wrong when registering user for call: ${newState.member.id} - ${newState.member.username}`)
		}
	} else if (oldState.channel != null && newState.channel == null) {
		if (oldState.member.id == client.user.id) {
			return //If the user is breadbot, ignore and exit
		}

		logger.info(`Channel Exit Detected ${oldState.guild.id} - ${oldState.channelId} - ${oldState.member.id}`)

		var existingCallID = await sqlutil.inCall(oldState.guild.id, oldState.channelId)

		logger.info(`Existing call ID ${existingCallID}`)

		if (existingCallID != -1) {
			await sqlutil.deregisterUserInCall(existingCallID, oldState.member.id)

			var usersInCall = await sqlutil.getNumberUsersInCall(existingCallID)

			if (usersInCall == 0) {
				const connection = getVoiceConnection(oldState.guild.id)
				connection.disconnect()

				var didUpdateEndTime = await sqlutil.updateCallEndTime(existingCallID, new Date())

				if (!didUpdateEndTime) {
					logger.error(`Failed to mark call ID ${existingCallID} as ended with an end date`)
				}
			}
		} else {
			logger.error("Couldn't find a call ID based on the guild and channel info, was Breadbot in the call?")
		}
	}
})

client.on(Events.MessageCreate, async message => {
	console.info("Message Create Fired")

	var channel_ok = await sqlutil.registerChannelIfMissing(message.channelId, message.channel.guild.id, message.channel.name)
	var user_ok = await sqlutil.registerUserIfMissing(message.author.id, message.author.username, message.author.displayName)

	logger.info(`Channel Ok? ${channel_ok} User OK? ${user_ok}`)

	if (channel_ok && user_ok) {
		await sqlutil.registerMessage(message.id, message.channelId, message.author.id, message.content, message.createdAt).then(async message_add => {
			if(message_add) {
				logger.info("Message Added")

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
						logger.error(error)
					})
				}
			} else {
				logger.error("Failed to log message")
			}
		})
	}
})

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
	logger.info("Message Update Fired")
	logger.info(`Old Message Snowflake: ${oldMessage.id} New Message Snowflake: ${newMessage.id}`)

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
					logger.error(error)
				})
			}
		}
	})
})

client.on(Events.MessageDelete, async deletedMessage => {
	await sqlutil.markMessageDeletedIfPresent(deletedMessage.id)
})

client.once(Events.ClientReady, c => {
	logger.info(`Ready! Logged in as ${c.user.tag} - ${c.user.id}`)
});

client.login(token);