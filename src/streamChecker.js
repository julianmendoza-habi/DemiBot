const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const clientId = process.env.TWITCH_CLIENT_ID;

// Function to check if the streamers are live 
const checkStreamersStatus = async (client) => {
    if (!client.twitchToken) return;
    //Get the streamers from the db
    const collectionName = "streamAlerts";
    const collection = client.db.collection(collectionName);
    const streamers = await collection.find().toArray();
    //Loop through all the streamers
    for (const streamer in streamers) {
        //Check if the streamer is live
        const streamId = await checkStreamerStatus(streamers[streamer], streamers[streamer].streamer_name, client)
        if(streamId != false){
            await collection.updateOne({streamer_name: streamers[streamer].streamer_name}, { $set: {lastStreamId: streamId} });
        }
    }
};

const checkStreamerStatus = async (alertInfo, streamer, client) => {
    try {
        const lastStreamId = alertInfo.lastStreamId;
        const twitchToken = client.twitchToken;

        const response = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${streamer}`, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${twitchToken}` ,
            },
        });
    
        const streamData = response.data.data[0];
        
        if (streamData && streamData.type === 'live' && lastStreamId !== streamData.id) {
            // If the streamer is live and the last stream id is different from the current stream id
            // Send the message to the channel
            const messages = await sendStreamerAlerts(alertInfo.messages, streamer, client)
            if(messages){
                return streamData.id;
            }
        }
        return false
    } catch (error) {
        console.error('Error checking streamer status:', error.message);
        console.error(error)
        return false
    } 
}

const sendStreamerAlerts = async (messages, streamer, client) => {
    for(const alert in messages){
        try{
            const message = messages[alert].message;
            const channelId = messages[alert].channel;
            const role = messages[alert].role;
            const twitchLink = `https://twitch.tv/${streamer}`;
            const channel = await client.channels.fetch(channelId);
            if(role){
                if(role == 'everyone'){
                    await channel.send(`@everyone ${twitchLink} ${message}`)
                } else {
                    await channel.send(`<@&${role}> ${twitchLink} ${message}`)
                }
            } else {
                await channel.send(`${twitchLink} ${message}`)
            }
        } catch (error) {
            console.error('Error sending streamer alerts:', error.message);
        }
    }
    return true;
}

module.exports = {
    checkStreamersStatus,
}