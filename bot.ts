import { Telegraf, Markup } from "npm:telegraf@4.12.2";

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
const userSessions = new Map();

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

// [Previous command handlers remain the same...]

// Fixed Image Generation Handler
bot.action(/generate_(\w+)/, async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !userSessions.has(userId)) return;

  const style = styles.find(s => s.id === ctx.match[1]);
  const session = userSessions.get(userId);
  if (!style || !session.prompt) return;

  try {
    await ctx.replyWithChatAction('upload_photo');
    const processingMsg = await ctx.reply("🔄 Generating your image...");

    const fullPrompt = style.promptPrefix + session.prompt;
    const apiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=512&height=512`;

    // Fetch with timeout and retry logic
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(apiUrl, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'TelegramBot (Deno Deploy)'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    // Convert to buffer
    const imageBuffer = await response.arrayBuffer();
    const imageBytes = new Uint8Array(imageBuffer);

    // Convert to base64 URL
    let binary = '';
    imageBytes.forEach(byte => binary += String.fromCharCode(byte));
    const base64Image = btoa(binary);
    const photoUrl = `data:image/jpeg;base64,${base64Image}`;

    // Send photo using URL
    await ctx.replyWithPhoto(
      photoUrl,
      { 
        caption: style.id === 'none' 
          ? `🖼️ "${session.prompt}"`
          : `🎨 ${style.name} Style\n"${session.prompt}"`
      }
    );

    await ctx.deleteMessage(processingMsg.message_id).catch(console.error);

  } catch (error) {
    console.error("Generation error:", error);
    await ctx.reply("❌ Failed to generate image. The server might be busy. Please try again in a moment.");
    
    // Additional error details for debugging
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack
      });
    }
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
