const Discord = require('discord.js');
const {prefix, token} = require('./config.json');
const ytdl = require('ytdl-core');

var youtubeSearchApi = require('youtube-search-api');

const client = new Discord.Client();
client.login(token)

client.once('ready', () => console.log("Tune is ready!"));
client.once('reconneting', () => console.log("Tune is reconnecting..."));
client.once('disconnect', () => console.log("Tune has disconnected."));

const queues = new Map();

client.on('message', async message => {
    if(message.author.bot || !message.content.startsWith(prefix)) return;
    
    const serverQueue = queues[message.guild.id];

    if(message.content.startsWith(`${prefix}play`))
        return tryPlaying(message, serverQueue)
    if(message.content.startsWith(`${prefix}skip`))
        return skip(message, serverQueue)
    if(message.content.startsWith(`${prefix}stop`))
        return stop(message, serverQueue)
    if(message.content.startsWith(`${prefix}undo`))
        return undo(message, serverQueue);
    if(message.content.startsWith(`${prefix}queue`))
        return showQueue(message, serverQueue);
    if(message.content.startsWith(`${prefix}loop`))
        return loopQueue(message, serverQueue);

})

async function tryPlaying(message, serverQueue) {
    const args = message.content.split(" ").slice(1).join("");
    const voiceChannel = message.member.voice.channel;

    if(!voiceChannel) 
        return message.channel.send("You need to be in a voice channel.");

    const permissions = voiceChannel.permissionsFor(message.client.user);
    if(!permissions.has("CONNECT") || !permissions.has("SPEAK"))
        return message.channel.send("Tune needs permissions to speak and join voice channel");
    

    let songInformation; 

    try {
        //if argument is URL
        songInformation = await ytdl.getInfo(args);
    }
    catch {
        try {
            const videos = await youtubeSearchApi.GetListByKeyword(args, false);
            const firstVideoId = videos.items[0].id;
            songInformation = await ytdl.getInfo(firstVideoId);
        }
        catch {
            return message.channel.send("Error finding song.")
        }
    }

    const song = {
        title: songInformation.videoDetails.title,
        url: songInformation.videoDetails.video_url
    }


    if(!serverQueue) {
        const queue = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null, 
            songs: [],
            volume: 5,
            playing: true, 
            looping: false
        }

        queues[message.guild.id] = queue;
        queue.songs.push(song);

        try {
            let connection = await voiceChannel.join();
            queue.connection = connection;

            play(message.guild, song)
        } catch (error) {
            console.log(error);
            queues.delete(message.guild.id);
            return message.channel.send(error);
        }
    } else {
        // Switch voice channel if user is somewhere else
        if(serverQueue.voiceChannel != voiceChannel)
        {
            let connection = await voiceChannel.join();
            serverQueue.connection = connection;
        }

        serverQueue.songs.push(song);

        if(!serverQueue.playing)
        {
            play(message.guild, serverQueue.songs[0]);
            serverQueue.playing = true;
            return;
        } else 
            return message.channel.send(`${song.title} has been added to queue`);
    }
}

function play(guild, song) {

    const serverQueue = queues[guild.id]

    if(!song) {
        serverQueue.playing = false;
        return;
    }

    const dispatcher = serverQueue.connection.play(ytdl(song.url))
    .on("finish", () => {
        let endedSong = serverQueue.songs.shift();
        if(serverQueue.looping)
            serverQueue.songs.push(endedSong)
        play(guild, serverQueue.songs[0]);
    })
    .on("error", error => console.error(error));

    dispatcher.setVolumeLogarithmic(serverQueue.volume/5);
    serverQueue.textChannel.send(`Started playing ${song.title}`)
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send("You must be in voice channel to skip music!");
    if (!serverQueue)
        return message.channel.send("Queue is empty.");
    serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send("You must be in voice channel to stop music!");
    if (!serverQueue)
        return message.channel.send("Queue is empty.");
    
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}

function undo(message, serverQueue) {
    if (!serverQueue)
        return message.channel.send("Queue is empty.");

    if(serverQueue.songs.length > 0)
    {
        message.channel.send(`Deleted ${serverQueue.songs.pop().title} from queue`);
    }
}

function showQueue(message, serverQueue) {
    if (!serverQueue)
        return message.channel.send("Queue is empty.");

    
    if(serverQueue.songs.length > 0)
    {
        let list = ""
        for(let s of serverQueue.songs)
        {
            list += s.title + "\n";
        }
        message.channel.send(list);
    }
}

function loopQueue(message, serverQueue) {
    if (!serverQueue)
        return message.channel.send("Queue is empty.");

    if(!serverQueue.looping)
    {
        serverQueue.looping = true;
        return message.channel.send("Started looping.");
    } else {
        serverQueue.looping = false;
        return message.channel.send("Stopped looping.");
    }
}