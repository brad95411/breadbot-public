const { google } = require('googleapis');
const { googlePrivateKey, googleClientEmail, googleProjectNumber } = require('../config.json');
const { stdout } = require('node:process');
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

async function getCalendarReference() {
	const jwtClient = new google.auth.JWT(
		googleClientEmail,
		'../keyfile.json',
		googlePrivateKey,
		SCOPES,
	);

	return new google.calendar({
		version: 'v3',
		project: googleProjectNumber,
		auth: jwtClient,
	});
}

async function doesCalendarExist(calendarName) {
	const calendarReference = await getCalendarReference();
	const listResults = await calendarReference.calendarList.list({});
	console.log(listResults);
	console.log(listResults.data.items);

	for (const item of listResults.data.items) {
		console.log(item);
		console.log('[DEBUG]: Calendar Item Summary: ' + item.summary);
		if (item.summary === calendarName) {
			console.log('[DEBUG]: The previous item is causing doesCalendarExist to return true');
			return item;
		}
	}

	return null;
}

// TODO This needs to be changed so that it uses the common callback
// format that I've created
async function getListOfCalendars(options, callback) {
	const calendarReference = await getCalendarReference();
	calendarReference.calendarList.list(options, callback);
}

async function addCalendar(calendarName, callback) {
	const calendarReference = await getCalendarReference();
	calendarReference.calendars.insert({
		resource: {
			summary: calendarName,
		},
	},
	// eslint-disable-next-line no-unused-vars
	async (err, res) => {
		if (err) {
			callback(false, 'Failed to create new calendar ' + calendarName + '\nAsk Bradley to check Breadbat console', err);
			stdout.write('[ERROR]: ');
			console.log(err.errors);
			return;
		}

		callback(true, 'Successfully created new calendar ' + calendarName, null);
	});
}

async function deleteCalendar(calendarName, callback) {
	const exists = await doesCalendarExist(calendarName);

	if (exists) {
		const calendarReference = await getCalendarReference();
		calendarReference.calendars.delete({
			resource: {
				calendarId: exists.id,
			},
		},
		// eslint-disable-next-line no-unused-vars
		async (err, res) => {
			if (err) {
				callback(false, 'Failed to delete ' + calendarName + '\nAsk Bradley to check Breadbot console', err);
				stdout.write('[ERROR]: ');
				console.log(err.errors);
				return;
			}

			callback(true, 'Successfully deleted ' + calendarName, null);
		});
	}
	else {
		callback(false, 'The calendar name specified doesn\'t exist', null);
	}
}

module.exports = {
	getCalendarReference,
	getListOfCalendars,
	doesCalendarExist,
	deleteCalendar,
	addCalendar,
};