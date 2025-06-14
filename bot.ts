import { Telegraf, Markup } from "telegraf";

// Styles configuration
const styles = [
  {
    id: 'none',
    name: 'None (Original Prompt)',
    preview: 'https://www.rws.com/media/images/scs-ai-new-img-hero-1920x1080b-03_tcm228-261952.webp',
    promptPrefix: ''
  },
  {
    id: 'realistic',
    name: 'Realistic',
    preview: 'https://scitechdaily.com/images/Realistic-Face-Close-Up-Art-Concept.jpg',
    promptPrefix: 'realistic style, highly detailed, photorealistic, '
  },
  {
    id: 'anime',
    name: 'Anime',
    preview: 'https://cdn-ilbddpb.nitrocdn.com/NtLGjbwnqkJcuwMPakRycZOtLkWgNRrM/assets/images/optimized/rev-97f5013/aihustlesage.com/wp-content/uploads/2024/08/word-image-720-2.jpeg',
    promptPrefix: 'anime style, vibrant colors, Japanese animation, '
  },
  {
    id: 'digital-art',
    name: 'Digital Art',
    preview: 'https://fineartshippers.com/wp-content/uploads/2024/12/digital-art-and-artificial-intelligence.png',
    promptPrefix: 'digital art, concept art, intricate details, '
  },
];

const botToken = "7778560460:AAE8K1DHUDeu1x4xhzGiFuHNHtvLaOi-i7k";
if (!botToken) {
  console.error("ERROR: Missing TELEGRAM_BOT_TOKEN");
  Deno.exit(1);
}

const bot = new Telegraf(botToken);

// User sessions storage
const userSessions = new Map<number, {
  currentStyleIndex: number;
  prompt?: string;
}>();

// Webhook setup for Deno Deploy
const PORT = Deno.env.get("PORT") || 3000;
const WEBHOOK_URL = Deno.env.get("WEBHOOK_URL");

// Start command
bot.start((ctx) => {
  return ctx.reply(
    "🎨 Welcome to AI Image Generator!\n\n" +
    "In private chat: Just send your prompt\n" +
    "In groups: Use /gen [prompt]",
    Markup.keyboard([['Generate Random Image']])
      .resize()
  );
});

// Handle /gen command in groups
bot.command('gen', async (ctx) => {
  if (ctx.chat.type === 'private') {
    return ctx.reply("In private chat, just send your prompt directly (no /gen needed)");
  }

  const prompt = ctx.message.text.replace('/gen', '').trim();
  if (!prompt) {
    return ctx.reply('Please provide a prompt after /gen\nExample: /gen a beautiful landscape');
  }
  await processPrompt(ctx, prompt);
});

// Handle all text messages
bot.on('text', async (ctx) => {
  if (ctx.chat.type !== 'private' && !ctx.message.reply_to_message) return;

  if (ctx.message.text === 'Generate Random Image') {
    const randomPrompts = [
      "a futuristic city at night",
      "a magical forest with glowing plants",
      "a cute robot pet playing in the park",
      "an underwater kingdom with mermaids",
      "a steampunk airship flying through clouds"
    ];
    const randomPrompt = randomPrompts[Math.floor(Math.random() * randomPrompts.length)];
    await processPrompt(ctx, randomPrompt);
    return;
  }

  await processPrompt(ctx, ctx.message.text);
});

// Handle replies to bot messages
bot.on('message', async (ctx) => {
  if (ctx.message.reply_to_message?.from?.id === ctx.botInfo?.id) {
    await processPrompt(ctx, ctx.message.text);
  }
});

// Common function to process prompts
async function processPrompt(ctx: any, prompt: string) {
  const userId = ctx.from.id;
  userSessions.set(userId, {
    currentStyleIndex: 0,
    prompt: prompt
  });
  await showStyleSelection(ctx, userId);
}

// Style selection handler
async function showStyleSelection(ctx: any, userId: number) {
  const session = userSessions.get(userId);
  if (!session || !session.prompt) return;

  const style = styles[session.currentStyleIndex];
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('◀️ Prev', 'prev_style'),
      Markup.button.callback('Next ▶️', 'next_style')
    ],
    [Markup.button.callback(`Generate with ${style.name}`, `generate_${style.id}`)]
  ]);

  try {
    await ctx.replyWithPhoto(style.preview, {
      caption: `Style: ${style.name}\nPrompt: ${session.prompt}`,
      ...keyboard
    });
  } catch (error) {
    console.error("Preview image error:", error);
    await ctx.reply(`Style: ${style.name}\nPrompt: ${session.prompt}`, keyboard);
  }
}

// Navigation handlers
bot.action(/prev_style|next_style/, async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !userSessions.has(userId)) return;

  const session = userSessions.get(userId)!;
  session.currentStyleIndex += ctx.match[0] === 'next_style' ? 1 : -1;
  
  if (session.currentStyleIndex >= styles.length) session.currentStyleIndex = 0;
  if (session.currentStyleIndex < 0) session.currentStyleIndex = styles.length - 1;

  await ctx.deleteMessage().catch(console.error);
  await showStyleSelection(ctx, userId);
});

// Image generation handler - NO TEMP FILES
bot.action(/generate_(\w+)/, async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !userSessions.has(userId)) return;

  const style = styles.find(s => s.id === ctx.match[1]);
  const session = userSessions.get(userId)!;
  if (!style || !session.prompt) return;

  try {
    await ctx.replyWithChatAction('upload_photo');
    const processingMsg = await ctx.reply("🔄 Generating your image...");

    const fullPrompt = style.promptPrefix + session.prompt;
    const apiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}`;

    // Fetch image directly without temp files
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error("Failed to fetch image");

    const imageBuffer = await response.arrayBuffer();
    
    // Send photo directly from memory
    await ctx.replyWithPhoto(
      { source: new Uint8Array(imageBuffer) },
      { 
        caption: style.id === 'none' 
          ? `🖼️ "${session.prompt}"`
          : `🎨 ${style.name} Style\n"${session.prompt}"`
      }
    );

    await ctx.deleteMessage(processingMsg.message_id).catch(console.error);

  } catch (error) {
    console.error("Generation error:", error);
    await ctx.reply("❌ Failed to generate image. Please try a different prompt.");
  }
});

// Start the bot with webhook if in production
if (WEBHOOK_URL) {
  console.log("Starting bot in webhook mode...");
  bot.telegram.setWebhook(`${WEBHOOK_URL}/bot${botToken}`);
  bot.startWebhook(`/bot${botToken}`, null, PORT);
} else {
  console.log("Starting bot in polling mode...");
  bot.launch()
    .then(() => console.log("Bot is running"))
    .catch(err => console.error("Bot failed:", err));
}

// Graceful shutdown
Deno.addSignalListener("SIGINT", () => {
  console.log("\nShutting down...");
  bot.stop();
  Deno.exit();
});
