const fs = require('fs');
const Database = require('better-sqlite3');

// Initialize the meowtabase
let meowDb = null;
function getMeowDb() {
    if (!meowDb) {
        const dbPath = './meow.db';
        meowDb = new Database(dbPath);
        
        // Create the meow table if it doesn't exist
        meowDb.exec(`
            CREATE TABLE IF NOT EXISTS meows (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user TEXT NOT NULL,
                server_name TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_user_server ON meows(user, server_name);
        `);
    }
    return meowDb;
}

function formatMessage(msg) {
	fireReacts = msg.reactions.resolve('🔥')?.count || 0; //if we can't resolve it, it just gets set back to 0
	tomatoReacts = msg.reactions.resolve('🍅')?.count || 0;
	sobReacts = msg.reactions.resolve('😭')?.count || 0;

	let attachUrl;
	if (msg.attachments.first()) {
		attachUrl = msg.attachments.first().attachment;
	}
	let formattedMessage = {
		channelId: msg.channelId,
		guildId: msg.guildId,
		id: msg.id,
		authorId: msg.author.id,
		content: msg.content,
		attachmentUrl: attachUrl,
		fireReacts,
		tomatoReacts,
		sobReacts
	};

	return formattedMessage;
}

let messagesToWrite = {};
function updateCacheWhileRunning(message, isReaction, emoji) {
    let fileName = `./messagecache/${message.guild.name}/${message.channel.id}.json`;
    if (!messagesToWrite[message.channel.id]) {
        messagesToWrite[message.channel.id] = [formatMessage(message)];
        setTimeout(() => {
            let currentChannelData;
            try {
                currentChannelData = JSON.parse(fs.readFileSync(fileName));
            } catch {
                currentChannelData = [];
            }
            messagesToWrite[message.channel.id].forEach(message => {
                let isDuplicate = false
                for (let i = 0; i < currentChannelData.length; i++) {
                    if (currentChannelData[i].id == message.id) {
                        currentChannelData[i] = message;
                        isDuplicate = true;
                        console.log(`	found a duplicate, so i'm updating an old reaction~ ehe~`);
                    }
                }
                if (!isDuplicate) {
                    currentChannelData.push(message);
                }
            });

            let guildDirectory = `./messagecache/${message.guild.name}`;
            if (!fs.existsSync(guildDirectory)) {
                fs.mkdirSync(guildDirectory, { recursive: true }); //if the server directory doesn't already exist, we wanna make it :p
            }
            fs.writeFile(fileName, JSON.stringify(currentChannelData, null, 2), (err) => {
                if (err) throw err;
                console.log(`updated cache for ${message.guild.name}'s #${message.channel.name} with new messages >w<`);
            });
            delete messagesToWrite[message.channel.id]; //removes the channel from messagesToWrite, effectively resetting it
        }, process.env.CACHE_WRITE_FREQUENCY? parseInt(process.env.CACHE_WRITE_FREQUENCY) : 60000); //runs every 60 seconds by default
    } else {
        if (isReaction) {
            messagesToWrite[message.channel.id].forEach(entry => {
                if (entry.id == message.id) {
                    switch (emoji) {
                        case '🔥':
                            entry.fireReacts++;
                            break;
                        case '🍅':
                            entry.tomatoReacts++;
                            break;
                        case '😭':
                            entry.sobReacts++;
                            break;
                    }
                }
            });
        } else {
            messagesToWrite[message.channel.id].push(formatMessage(message));
        }
    }
}

function filter(filterType, messagesList, message) {
    switch (filterType) {
        case "any":
            if ((message.fireReacts > 0 || message.tomatoReacts > 0 || message.sobReacts > 0) && (message.content.length > 0 || message.attachmentUrl)) {
                messagesList.push(message);
            }
            break;
        case "tomato":
            if (message.tomatoReacts > 0 && (message.content.length > 0 || message.attachmentUrl)) {
                messagesList.push(message);
            }
            break;
        case "sob":
            if (message.sobReacts > 0 && (message.content.length > 0 || message.attachmentUrl)) {
                messagesList.push(message);
            }
            break;
        case "fire":
            if (message.fireReacts > 0 && (message.content.length > 0 || message.attachmentUrl)) {
                messagesList.push(message);
            }
            break;
        case "none":
            if (message.content.length > 0 || message.attachmentUrl) {
                messagesList.push(message);
            }
            break;
    }
    return messagesList; //returns back the whole message list +1 message if we matched it
}

function readServerChannels(guildName, filterType, filterUser) {
    let messagesList = [];
    let channels = fs.readdirSync(`./messagecache/${guildName}`);

    channels.forEach(channel => {
        let channelData = JSON.parse(fs.readFileSync(`./messagecache/${guildName}/${channel}`));
        channelData.forEach(message => {
            if (filterUser != undefined) { //if we have a user to filter for
                if (filterUser == message.authorId) {
                    messagesList = filter(filterType, messagesList, message);
                }
            } else { //if we don't have any user we're looking for~
                messagesList = filter(filterType, messagesList, message);
            }
        });
    });

    return messagesList;
}

function addToMeowDb(authorId, serverName, timestamp) {
    const db = getMeowDb();
    
    try {
        const insert = db.prepare('INSERT INTO meows (user, server_name, timestamp) VALUES (?, ?, ?)');
        insert.run(authorId, serverName, timestamp);
    } catch (err) {
        console.error('Error adding meow to database:', err);
    }
}

function getLeaderboardData(serverName) {
    const db = getMeowDb();
    
    try {
        const query = db.prepare(`
            SELECT user, COUNT(*) as totalCount
            FROM meows
            WHERE server_name = ?
            GROUP BY user
            ORDER BY totalCount DESC
        `);
        
        const results = query.all(serverName);
        return results.map(row => ({
            user: row.user,
            totalCount: row.totalCount
        }));
    } catch (err) {
        console.error('Error getting leaderboard data:', err);
        return [];
    }
}

module.exports = {
    readServerChannels, addToMeowDb, updateCacheWhileRunning, getLeaderboardData, formatMessage
}