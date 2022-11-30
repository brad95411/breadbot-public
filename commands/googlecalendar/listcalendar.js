const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getListOfCalendars } = require('../../utilities/googlecalendar');
const { stdout } = require('node:process');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('listcalendars')
		.setDescription('Lists the currently available calendars'),
	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true });

		getListOfCalendars({}, async (err, res) => {
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