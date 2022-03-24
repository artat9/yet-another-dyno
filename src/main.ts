import {
  Collection,
  Client,
  Message,
  MessageReaction,
  TextChannel,
  User,
} from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: ['GUILDS', 'GUILD_MEMBERS', 'GUILD_MESSAGES'],
});

let start = false;

const token = process.env.TOKEN || '';
const guildId = process.env.GUILD_ID || '';
client.login(token);

const main = async (message: Message<boolean>) => {
  if (!token) {
    console.log('token not found');
    return;
  }
  if (!guildId) {
    console.log('guild id not found');
    return;
  }
  const guild = message.guild;
  if (guild?.id !== guildId) {
    return;
  }
  if (!guild) {
    console.log('guild not found');
    return;
  }

  console.log('fetch all members');
  const ms = await guild.members.fetch();

  console.log('total users:', Array.from(ms.values()).length);
  const verifyChannel = (await guild.channels.fetch())
    ?.filter((ch) => ch.name.includes('verify'))
    .first();
  if (!verifyChannel) {
    console.log('verify channel not found');
    return;
  }
  const txtChannel = verifyChannel as TextChannel;
  const msgs = await txtChannel.messages.fetch();
  const dynoMsg = msgs.filter((m) => m.content == '').first();
  if (!dynoMsg) {
    console.log('msg not found');
    return;
  }
  console.log('fetch all reacted users');
  const users = await fetchAll(dynoMsg, '✅', {
    userOnly: true,
    botOnly: false,
  });
  console.log('users size:', users.length);
  const roles = await guild.roles.fetch();
  const memberRole = roles?.filter((r) => r.name.includes('Member')).first();
  if (!memberRole) {
    console.log('role not found');
    return;
  }
  for (const user of Array.from(users.values())) {
    try {
      const m = ms.filter((m) => m.user.id == user.id).first();
      if (!m) {
        console.log('member doesnt exist:', user.username);
        continue;
      }
      if (m.roles.cache.filter((r) => r.name.includes('Member')).first()) {
        continue;
      }
      console.log('role to', m.displayName);
      await m.roles.add(memberRole);
      console.log('added role:', m.displayName);
      delay(100);
    } catch (e) {
      console.log(e);
    }
  }
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const fetchAll = async (
  message: Message,
  reaction: string,
  options = { botOnly: false, userOnly: false }
) => {
  if (!(message instanceof Message))
    throw new Error(
      'discord-fetch-all: channel parameter is not a instance of a discord channel.'
    );
  if (typeof reaction !== 'string')
    throw new Error('discord-fetch-all: reaction parameter is not a string.');
  const { userOnly, botOnly } = options;
  let users: User[] = [];
  let lastID = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let fetchedUsers: (MessageReaction | undefined) | Collection<string, User> =
      lastID !== ''
        ? await message.reactions.cache.get(reaction)
        : await message.reactions.cache.get(reaction);

    if (!fetchedUsers) return [];

    fetchedUsers =
      lastID !== ''
        ? await fetchedUsers.users.fetch({ limit: 100, after: lastID })
        : await fetchedUsers.users.fetch({ limit: 100 });

    if (fetchedUsers.size === 0) {
      if (userOnly) users = users.filter((user) => !user.bot);
      if (botOnly) users = users.filter((user) => user.bot);
      return users;
    } else {
      fetchedUsers.forEach((u) => users.push(u));
      lastID = users[users.length - 1].id;
    }
  }
};

// fetch GuildMembers is enabled on websocket connection only. so receive msg on ws channel
client.on('messageCreate', async function (message) {
  if (message.guildId !== guildId) {
    return;
  }
  if (start) {
    return;
  }
  start = true;
  await main(message);
  process.exit(0);
});
