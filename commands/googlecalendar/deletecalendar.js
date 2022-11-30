const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { deleteCalendar } = require('../../utilities/googlecalendar.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('deletecalendar')
		.setDescription('Permanently deletes a calendar and it\'s associated events')
		.addStringOption(option =>
			option
				.setName('name')
				.setDescription('The name of the calendar you want to delete')
				.setRequired(true)),
	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true });

		const name = interaction.options.getString('name');

		// eslint-disable-next-line no-unused-vars
		deleteCalendar(name, async (success, message, extra) => {
			const embedResponse = new EmbedBuilder()
				.setColor(success ? 0x0FF00 : 0xFF0000)
				.setTitle(message);

			await interaction.editReply({ embeds: [ embedResponse ] });
		});
	},
};