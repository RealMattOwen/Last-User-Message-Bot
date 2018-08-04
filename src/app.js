import Discordie from 'discordie';
import mongoose from 'mongoose';
import { token } from './configuration';
import Message from './models/message';

const Events = Discordie.Events;
const client = new Discordie({ autoReconnect: true });

const command = '!last-activity';
const serverName = 'Codeflow Community';

mongoose.Promise = global.Promise;

mongoose.connect('mongodb://localhost:27017/track_last_user_message', { useNewUrlParser: true })
	.then(() => {
		console.log('DB connection established');

		client.connect({ token });

		client.Dispatcher.on(Events.GATEWAY_READY, () => {
			console.log(`Connected as: ${client.User.username}!`);
		});

		client.Dispatcher.on(Events.MESSAGE_CREATE, async (e) => {
			if (e.message.guild.name === serverName && e.message.channel.name !== 'moderators') {
				const { message: { author: messageSender, channel, content: messageContent, guild: { members: serverMembers }, timestamp } } = e;

				if (!messageSender.bot) {
					if (messageContent.includes(command)) {
						checkIfUserHasMsgInDB(messageSender)
							.then(() => {
								updateLatestUserMessage({ messageSender, messageContent, timestamp });
							})
							.catch(async () => {
								const message = new Message({
									author: messageSender.id,
									content: messageContent,
									timestamp
								});

								await message.save();
							});

						const mention = serverMembers.find((user) => {
							const regex = new RegExp(/<@!?(.*?)>/g);
							const matches = regex.exec(messageContent);

							if (matches && user.id === matches[1]) {
								return user;
							}
						});

						if (mention) {
							checkIfUserHasMsgInDB(mention).then(({ content, timestamp }) => {
								const parsedContent = content.replace(/<@!?(.*?)>/g, (content) => {
									const regex = new RegExp(/<@!?(.*?)>/g);
									const matches = regex.exec(content);

									const { discriminator, username } = serverMembers.find((user) => {
										return user.id === matches[1];
									});

									return `<@${username}#${discriminator}>`;
								});

								const now = new Date();
								const timeDifference = now.getTime() - timestamp.getTime();

								const secs = Math.floor(timeDifference / 1000);

								const formattedDateObject = {
									days: Math.floor(secs / 86400),
									hours: Math.floor(secs / 3600) % 24,
									minutes: Math.floor(secs / 60) % 60,
									seconds: Math.floor(secs) % 60
								};

								const formattedTimestamp = Object.keys(formattedDateObject)
									.reduce((acc, cV) => {
										if (formattedDateObject[cV]) {
											if (acc.length + 1 > 3) {
												return acc;
											} else {
												return [...acc, `${formattedDateObject[cV]} ${formattedDateObject[cV] === 1 ? cV.slice(0, -1) : cV}`];
											}
										} else {
											return acc;
										}
									}, [])
									.join(', ');

								channel.sendMessage(`${mention.username}'s last message was "${parsedContent}" and was sent ${formattedTimestamp} ago.`);
							}).catch((error) => {
								console.log(error);
								channel.sendMessage(error);
							});
						}
					} else {
						checkIfUserHasMsgInDB(messageSender)
							.then(() => {
								updateLatestUserMessage({ messageSender, messageContent, timestamp });
							})
							.catch(async () => {
								const message = new Message({
									author: messageSender.id,
									content: messageContent,
									timestamp
								});

								await message.save();
							});
					}
				}
			}
		});
	})
	.catch(error => {
		console.log(error);
		console.log('DB connection failed')
	});

const checkIfUserHasMsgInDB = async (author) => {
	const message = await Message.findOne({ author: author.id });

	if (message) {
		return message;
	} else {
		throw `No messages from <@${author.username}#${author.discriminator}> can be found.`;
	}
};

const updateLatestUserMessage = async ({ messageSender: author, messageContent: content, timestamp }) => {
	await Message.findOneAndUpdate({ author: author.id }, { content, timestamp });
};