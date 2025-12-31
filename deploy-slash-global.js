const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const dotenv = require('dotenv');
dotenv.config();

const commands = [];
let commandList = fs.readdirSync('./commands/');

commandList.forEach(file => {
	let command = require(`./commands/${file}`); //requires the file, so loading it in
	if ('data' in command && 'execute' in command) { //making sure that it has a data and execute property (needed for slash commands)
        commands.push(command.data.toJSON());
	} else {
		console.log(`\x1b[33m${file} doesnt seem to have a 'data' or 'execute' property >_<;; gomen,,\x1b[0m`);
	}
});

const rest = new REST().setToken(process.env.TOKEN); //rest api init
(async () => {
	try {
		console.log(`started refreshing ${commands.length} slash commands >w<`);
		let data = await rest.put(
			Routes.applicationCommands(process.env.CLIENT_ID),
			{ body: commands },
		);
		console.log(`succesfully refreshed ${data.length} slash commands~!! :3~`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(`\x1b[33msomething happened while refreshing slash commands,,: \x1b[0m${error}`);
	}
})();
