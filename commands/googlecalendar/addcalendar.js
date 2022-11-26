const { SlashCommandBuilder } = require('discord.js');
const { google } = require('googleapis');
const { googlePrivateKey, googleClientEmail, googleProjectNumber } = require('../../config.json');
const { stdout } = require('node:process');
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

		const jwtClient = new google.auth.JWT(
			googleClientEmail,
			'./keyfile.json',
			googlePrivateKey,
			SCOPES,
		);

		const calendar = new google.calendar({
			version: 'v3',
			project: googleProjectNumber,
			auth: jwtClient,
		});

		calendar.calendars.insert({
			resource: {
				summary: name,
			},
		},
		// eslint-disable-next-line no-unused-vars
		async (err, res) => {
			if (err) {
				await interaction.editReply('Failed to create calendar ' + name + '\nAsk Bradley to check Breadbot console');
				stdout.write('[ERROR]: ');
				console.log(err.errors);
				return;
			}
			await interaction.editReply('New Calendar ' + name + ' Created');
		},
		);
	},
};