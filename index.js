// Import the necessary packages and create a new instance of the App class
const dotenv = require('dotenv');
const { App, LogLevel } = require('@slack/bolt');
const { Pool } = require('pg');
const cron = require('node-cron');

dotenv.config();

const app = new App({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    token: process.env.SLACK_APP_TOKEN,
    logLevel: LogLevel.DEBUG,
    botToken: process.env.SLACK_BOT_TOKEN
    // botId: 'B04V1GB01R7'
});

// Schedule the /standup command to be sent every weekday at 9:30 am
cron.schedule('30 11 * * *', async () => {
  await app.client.chat.postMessage({
    channel: process.env.CHANNEL_ID,
    text: '/standup'
  });
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Prompt users for their standup updates
async function promptStandupQuestions(userId) {
    // Prompt user for first standup update
    await app.client.chat.postMessage({
      channel: userId,
      text: 'What did you work on yesterday?'
    });
  
    // Listen for user input in response to first standup prompt
    app.action('yesterday_update', async ({ body, ack, respond }) => {
      await ack();
      const yesterdayUpdate = body.actions[0].value;
  
      // Prompt user for second standup update
      await app.client.chat.postMessage({
        channel: userId,
        text: 'What are you working on today?'
      });
  
      // Listen for user input in response to second standup prompt
      app.action('today_update', async ({ body, ack, respond }) => {
        await ack();
        const todayUpdate = body.actions[0].value;
  
        // Prompt user for third standup update
        await app.client.chat.postMessage({
          channel: userId,
          text: 'Are there any blockers or issues you need help with?'
        });
  
        // Listen for user input in response to third standup prompt
        app.action('blockers_update', async ({ body, ack, respond }) => {
          await ack();
          const blockersUpdate = body.actions[0].value;
  
          // Store standup updates in Postgres or another database
          // ...
  
          // Send confirmation message to user
          await respond({
            text: 'Thanks for your standup updates!'
          });
        });
      });
    });
  }
  
// Listen for the `standup` command to trigger daily standup prompt
app.command('/standup', async ({ command, ack, say }) => {
    await ack();

    // Prompt each user in the channel for their standup updates
    const channelId = command.channel_id;
    const slackResponse = await fetch(`https://slack.com/api/conversations.members?token=${process.env.SLACK_APP_TOKEN}&channel=${channelId}`);
    const members = slackResponse.get("members");
    console.log(members)

    if (command.channel_members) {
	    const users = command.channel_members;
	    for (const userId of users) {
		await promptStandupQuestions(userId);
	    }
    }

    // Send confirmation message to channel
    await say('Daily standup prompts sent!');
});

// Start the app
(async () => {
    await app.start(process.env.PORT || 3000);
    console.log('App started!');
})();
