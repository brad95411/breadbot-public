const { SlashCommandBuilder } = require('discord.js');
const { google } = require('googleapis');
const { googlePrivateKey, googleClientEmail, googleProjectNumber } = require('../../config.json');
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('addcalendar')
		.setDescription('Creates a new Google Calendar')
		.addStringOption(option =>
			option
				.setName('name')
				.setDescription('The new name for the calendar')
				.setRequired(true))
		.addStringOption(option =>
			option
				.setName('description')
				.setDescription('The description of this new calendar')),
	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true });

		const name = interaction.options.getString('name');
		const description = interaction.options.getString('description');

		const jwtClient = new google.auth.JWT(
			googleClientEmail,
			null,
			googlePrivateKey,
			SCOPES,
		);

		const calendar = new google.calendar({
			version: 'v3',
			project: googleProjectNumber,
			auth: jwtClient,
		});

		calendar.calendarList.insert({
			'summary': name,
			'description': description,
		});

		await interaction.editReply('New Calendar ' + name + ' Created');
	},
};