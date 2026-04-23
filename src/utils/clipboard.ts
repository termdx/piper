export function copyToClipboard(text: string): void {
  if (!text) return;
  try {
    const b64 = Buffer.from(text, "utf8").toString("base64");
    const osc52 = `\x1b]52;c;${b64}\x07`;
    process.stdout.write(osc52);
  } catch {
    // silently fail
  }
}
