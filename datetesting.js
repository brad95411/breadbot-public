const readline = require('readline');

const r1 = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	terminal: false,
});

let date1 = null;
let date2 = null;
let result = null;

r1.on('line', line => {
	if (line.startsWith('date1')) {
		date1 = new Date(line.split(':')[1]);
	}
	else if (line.startsWith('date2')) {
		date2 = new Date(line.split(':')[1]);
	}
	else if (line.startsWith('result')) {
		if (date1 !== null && date2 !== null) {
			result = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate(),
				date2.getHours(), date2.getMinutes(), date2.getSeconds());

			console.log(result);
		}
	}
	else {
		console.log('Bad command');
	}
});

r1.once('close', () => {
	console.log('Closing');
});