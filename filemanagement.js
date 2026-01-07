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
            
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT NOT NULL UNIQUE,
                channel_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                guild_name TEXT NOT NULL,
                author_id TEXT NOT NULL,
                content TEXT,
                attachment_url TEXT,
                fire_reacts INTEGER DEFAULT 0,
                tomato_reacts INTEGER DEFAULT 0,
                sob_reacts INTEGER DEFAULT 0,
                created_at INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_message_id ON messages(message_id);
            CREATE INDEX IF NOT EXISTS idx_channel_id ON messages(channel_id);
            CREATE INDEX IF NOT EXISTS idx_guild_id ON messages(guild_id);
            CREATE INDEX IF NOT EXISTS idx_guild_name ON messages(guild_name);
            CREATE INDEX IF NOT EXISTS idx_author_id ON messages(author_id);
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
    const db = getMeowDb();
    
    if (!messagesToWrite[message.channel.id]) {
        messagesToWrite[message.channel.id] = [formatMessage(message)];
        setTimeout(() => {
            const insert = db.prepare(`
                INSERT OR REPLACE INTO messages 
                (message_id, channel_id, guild_id, guild_name, author_id, content, attachment_url, fire_reacts, tomato_reacts, sob_reacts, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const transaction = db.transaction((messages, guildName) => {
                for (const msg of messages) {
                    insert.run(
                        msg.id,
                        msg.channelId,
                        msg.guildId,
                        guildName,
                        msg.authorId,
                        msg.content || null,
                        msg.attachmentUrl || null,
                        msg.fireReacts || 0,
                        msg.tomatoReacts || 0,
                        msg.sobReacts || 0,
                        Date.now()
                    );
                }
            });
            
            try {
                transaction(messagesToWrite[message.channel.id], message.guild.name);
                console.log(`updated cache for ${message.guild.name}'s #${message.channel.name} with new messages >w<`);
            } catch (err) {
                console.error('Error writing messages to database:', err);
            }
            
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
    const db = getMeowDb();
    let messagesList = [];
    
    try {
        let query = `
            SELECT message_id as id, channel_id as channelId, guild_id as guildId, 
                   author_id as authorId, content, attachment_url as attachmentUrl,
                   fire_reacts as fireReacts, tomato_reacts as tomatoReacts, 
                   sob_reacts as sobReacts
            FROM messages
            WHERE guild_name = ?
        `;
        
        const params = [guildName];
        if (filterUser) {
            query += ' AND author_id = ?';
            params.push(filterUser);
        }
        
        const results = db.prepare(query).all(...params);
        
        // Convert database rows to message format and filter
        results.forEach(row => {
            const message = {
                id: row.id,
                channelId: row.channelId,
                guildId: row.guildId,
                authorId: row.authorId,
                content: row.content || '',
                attachmentUrl: row.attachmentUrl || null,
                fireReacts: row.fireReacts || 0,
                tomatoReacts: row.tomatoReacts || 0,
                sobReacts: row.sobReacts || 0
            };
            
            if (filterUser != undefined) {
                if (filterUser == message.authorId) {
                    messagesList = filter(filterType, messagesList, message);
                }
            } else {
                messagesList = filter(filterType, messagesList, message);
            }
        });
    } catch (err) {
        console.error('Error reading messages from database:', err);
    }
    
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
    readServerChannels, addToMeowDb, updateCacheWhileRunning, getLeaderboardData, formatMessage, getMeowDb
}