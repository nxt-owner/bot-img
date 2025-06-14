import { Telegraf } from "https://deno.land/x/telegraf@v4.12.2/mod.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");

const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => ctx.reply("👋 Send me a prompt to generate an image!"));

bot.on("text", async (ctx) => {
  const prompt = ctx.message.text;
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;

  await ctx.replyWithPhoto({ url: imageUrl }, { caption: `🖼️ Prompt: "${prompt}"` });
});

Deno.serve(async (req) => {
  try {
    const { pathname, searchParams } = new URL(req.url);
    if (pathname === "/") return new Response("Bot is running");
    return await bot.handleUpdate(await req.json(), req);
  } catch (_) {
    return new Response("Invalid request", { status: 400 });
  }
});
