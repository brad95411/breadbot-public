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

	for (const item of listResults.data.items) {
		if (item.summary === calendarName) {
			return item;
		}
	}

	return null;
}

async function getListOfCalendars(options, callback) {
	const calendarReference = await getCalendarReference();
	calendarReference.calendarList.list(options, async (err, res) => {
		if (err) {
			callback(false, 'Failed to retrieve the list of calendars\nAsk Bradley to check Breadbot console');
			stdout.write('[ERROR]:');
			console.log(err.errors);
			return;
		}

		callback(true, 'Calendar List', res.data.items);
	});
}

async function addCalendar(calendarName, timezone, callback) {
	const calendarReference = await getCalendarReference();
	calendarReference.calendars.insert({
		resource: {
			summary: calendarName,
			timeZone: timezone,
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
			calendarId: exists.id,
		},
		// eslint-disable-next-line no-unused-vars
		async (err, res) => {
			if (err) {
				callback(false, 'Failed to delete ' + calendarName + '\nAsk Bradley to check Breadbot console', err);
				stdout.write('[ERROR]: ');
				console.log(err);
				return;
			}

			callback(true, 'Successfully deleted ' + calendarName, null);
		});
	}
	else {
		callback(false, 'The calendar name specified doesn\'t exist', null);
	}
}

async function addEvent(calendarName, eventName, location, description, startDate, startTime, endDate, endTime) {
	const exists = await doesCalendarExist(calendarName);

	if (exists) {
		const calendarReference = await getCalendarReference();
		calendarReference.events.insert({
			calendarId: exists.id,
			resource: {
				summary: eventName,
				location: location,
				description: description,
				start: {
					
				}
			},
		})
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