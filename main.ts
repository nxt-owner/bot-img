import { Bot } from "https://deno.land/x/grammy@v1.20.1/mod.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");

const bot = new Bot(BOT_TOKEN);

bot.command("start", (ctx) => ctx.reply("👋 Send me a prompt to generate an image!"));

bot.on("message:text", async (ctx) => {
  const prompt = ctx.message.text.trim();
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
  try {
    await ctx.replyWithPhoto(imageUrl, {
      caption: `🖼️ Prompt: "${prompt}"`,
    });
  } catch {
    await ctx.reply("⚠️ Failed to generate image. Try again.");
  }
});

Deno.serve(async (req) => {
  try {
    const update = await req.json();
    await bot.handleUpdate(update);
    return new Response("ok");
  } catch {
    return new Response("Invalid update", { status: 400 });
  }
});
