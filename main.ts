import { Telegraf, Markup } from "npm:telegraf@4.12.2";

// Style configuration
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
  }
];

// Environment
const botToken = Deno.env.get("BOT_TOKEN");
const webhookUrl = Deno.env.get("WEBHOOK_URL");

if (!botToken) {
  console.error("ERROR: BOT_TOKEN not set");
  Deno.exit(1);
}

const bot = new Telegraf(botToken);
const userSessions = new Map<number, { prompt: string; currentStyleIndex: number }>();

// Start command
bot.start((ctx) => {
  ctx.reply(
    "🎨 Welcome to AI Image Generator!\n\nIn private chat: Just send your prompt\nIn groups: Use /gen [prompt]",
    Markup.keyboard([["Generate Random Image"]]).resize()
  );
});

// Handle /gen in groups
bot.command("gen", async (ctx) => {
  if (ctx.chat.type === "private") {
    return ctx.reply("Just send your prompt directly in private chat.");
  }
  const prompt = ctx.message.text.replace("/gen", "").trim();
  if (!prompt) return ctx.reply("Please provide a prompt. Example: /gen a mountain landscape");
  await processPrompt(ctx, prompt);
});

// Text input
bot.on("text", async (ctx) => {
  if (ctx.message.text === "Generate Random Image") {
    const randomPrompts = [
      "a futuristic city at night",
      "a magical forest with glowing plants",
      "a cute robot pet playing in the park",
      "an underwater kingdom with mermaids",
      "a steampunk airship flying through clouds",
    ];
    const randomPrompt = randomPrompts[Math.floor(Math.random() * randomPrompts.length)];
    return await processPrompt(ctx, randomPrompt);
  }
  if (ctx.chat.type !== "private" && !ctx.message.reply_to_message) return;
  await processPrompt(ctx, ctx.message.text);
});

// Reply input
bot.on("message", async (ctx) => {
  if (ctx.message.reply_to_message?.from?.id === ctx.botInfo?.id) {
    await processPrompt(ctx, ctx.message.text);
  }
});

async function processPrompt(ctx: any, prompt: string) {
  const userId = ctx.from.id;
  userSessions.set(userId, { prompt, currentStyleIndex: 0 });
  await showStyleSelection(ctx, userId);
}

async function showStyleSelection(ctx: any, userId: number) {
  const session = userSessions.get(userId);
  if (!session) return;

  const style = styles[session.currentStyleIndex];
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback("◀️ Prev", "prev_style"),
      Markup.button.callback("Next ▶️", "next_style"),
    ],
    [Markup.button.callback(`Generate with ${style.name}`, `generate_${style.id}`)],
  ]);

  try {
    await ctx.replyWithPhoto(style.preview, {
      caption: `Style: ${style.name}\nPrompt: ${session.prompt}`,
      ...keyboard,
    });
  } catch {
    await ctx.reply(`Style: ${style.name}\nPrompt: ${session.prompt}`, keyboard);
  }
}

bot.action(/prev_style|next_style/, async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !userSessions.has(userId)) return;

  const session = userSessions.get(userId)!;
  session.currentStyleIndex += ctx.match[0] === "next_style" ? 1 : -1;

  if (session.currentStyleIndex >= styles.length) session.currentStyleIndex = 0;
  if (session.currentStyleIndex < 0) session.currentStyleIndex = styles.length - 1;

  await ctx.deleteMessage().catch(() => {});
  await showStyleSelection(ctx, userId);
});

bot.action(/generate_(\w+)/, async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !userSessions.has(userId)) return;

  const session = userSessions.get(userId)!;
  const style = styles.find((s) => s.id === ctx.match[1]);
  if (!style) return;

  try {
    await ctx.replyWithChatAction("upload_photo");
    const loadingMsg = await ctx.reply("🔄 Generating your image...");

    const fullPrompt = style.promptPrefix + session.prompt;
    const apiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=512&height=512`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) throw new Error("Failed to fetch image");

    const imageBuffer = await response.arrayBuffer();
    const imageBytes = new Uint8Array(imageBuffer);
    const binary = String.fromCharCode(...imageBytes);
    const base64Image = btoa(binary);
    const photoUrl = `data:image/jpeg;base64,${base64Image}`;

    await ctx.replyWithPhoto(photoUrl, {
      caption: style.id === "none"
        ? `🖼️ "${session.prompt}"`
        : `🎨 ${style.name} Style\n"${session.prompt}"`,
    });

    await ctx.deleteMessage(loadingMsg.message_id).catch(() => {});
  } catch (e) {
    console.error(e);
    await ctx.reply("❌ Failed to generate image. Try again shortly.");
  }
});

// Deploy via webhook on Deno Deploy
if (webhookUrl) {
  bot.telegram.setWebhook(`${webhookUrl}/bot${botToken}`);
  bot.startWebhook(`/bot${botToken}`);
  console.log("Bot running with webhook on Deno Deploy");
} else {
  bot.launch().then(() => console.log("Bot running with polling (local)"));
}

Deno.addSignalListener("SIGINT", () => {
  console.log("Shutting down bot...");
  bot.stop();
});
