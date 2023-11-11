const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getListOfCalendars } = require('../../utilities/googlecalendar');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('listcalendars')
		.setDescription('Lists the currently available calendars'),
	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true });

		getListOfCalendars({}, async (success, message, extra) => {
			const embedResponse = new EmbedBuilder()
				.setColor(success ? 0x00FF00 : 0xFF0000)
				.setTitle(message)
				.setDescription(extra.map(x => x.summary + ' --- ' + x.timeZone).join('\n\n'));

			await interaction.editReply({ embeds: [ embedResponse ] });
		});
	},
};