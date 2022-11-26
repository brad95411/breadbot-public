const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { google } = require('googleapis');
const { googlePrivateKey, googleClientEmail, googleProjectNumber } = require('../../config.json');
const { stdout } = require('node:process');
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('listcalendars')
		.setDescription('Lists the currently available calendars'),
	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true });

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

		calendar.calendarList.list({}, async (err, res) => {
			if (err) {
				const errorEmbed = new EmbedBuilder()
					.setColor(0xFF0000)
					.setTitle('Failed to get a list of calendars')
					.setDescription('Ask Bradley to check Breadbot console');

				await interaction.editReply({ embeds: errorEmbed });
				stdout.write('[ERROR]: ');
				console.log(err.errors);
				return;
			}

			const successEmbed = new EmbedBuilder()
				.setColor(0x00FF00)
				.setTitle('Calendar List')
				.setDescription(res.data.items.map((x) => x.summary).join('\n'));

			await interaction.editReply({ embeds: [ successEmbed ] });
		});
	},
};