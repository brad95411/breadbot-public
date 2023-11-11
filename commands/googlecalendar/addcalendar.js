const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { addCalendar } = require('../../utilities/googlecalendar.js');
// const { getTimeZones } = require('@vvo/tzdb');

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
				.setName('timezone')
				.setDescription('The Time Zone of this new calendar, must be in IANA format')
				.setRequired(true)),
	// .addChoices(getTimeZones().map(tz => {
	//	return { name: tz.name, value: tz.name };
	// }))),
	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true });

		const name = interaction.options.getString('name');
		const timezone = interaction.options.getString('timezone');

		// eslint-disable-next-line no-unused-vars
		addCalendar(name, timezone, async (success, message, extra) => {
			const embedResponse = new EmbedBuilder()
				.setColor(success ? 0x00FF00 : 0xFF0000)
				.setTitle(message);

			await interaction.editReply({ embeds: [ embedResponse ] });
		});
	},
};