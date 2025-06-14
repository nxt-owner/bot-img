import { Telegraf } from "https://deno.land/x/telegraf@v4.12.2/mod.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");

const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => ctx.reply("👋 Send me a prompt to generate an image!"));

bot.on("text", async (ctx) => {
  const prompt = ctx.message.text.trim();
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;

  try {
    await ctx.replyWithPhoto(imageUrl, {
      caption: `🖼️ Prompt: "${prompt}"`,
    });
  } catch (err) {
    console.error("Image sending failed:", err);
    await ctx.reply("⚠️ Failed to send image. Try a different prompt.");
  }
});

Deno.serve(async (req) => {
  try {
    const update = await req.json();
    await bot.handleUpdate(update);
    return new Response("ok");
  } catch {
    return new Response("Invalid request", { status: 400 });
  }
});
