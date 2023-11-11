const { google } = require('googleapis');
const { googlePrivateKey, googleClientEmail, googleProjectNumber } = require('./config.json');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

async function main() {
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

	calendar.calendarList.list({}, (err, res) => {
		if (err) {
			console.log('[ERROR]');
			console.log(err.errors);
			return;
		}
		console.log(res.data.items.map(x => x.summary + '---' + x.timeZone));
	});
}

main().catch(e => {
	console.error(e);
	throw e;
});