const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { addCalendar } = require('../../utilities/googlecalendar.js');

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

		// eslint-disable-next-line no-unused-vars
		addCalendar(name, async (success, message, extra) => {
			const embedResponse = new EmbedBuilder()
				.setColor(success ? 0x00FF00 : 0xFF0000)
				.setTitle(message);

			await interaction.editReply({ embeds: [ embedResponse ] });
		});
	},
};