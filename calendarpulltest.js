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

	const response = calendar.calendarList.list({});
	console.log('Output: ' + response.data);
}

main().catch(e => {
	console.error(e);
	throw e;
});