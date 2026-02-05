import { chromium } from "playwright";
import * as path from "path";
import * as os from "os";

async function listNotebooks() {
  const userDataDir = path.join(os.homedir(), ".notebooklm-mcp-auth");
  console.log(`Using user data dir: ${userDataDir}`);

  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  console.log("Navigating to NotebookLM...");
  await page.goto("https://notebooklm.google.com/", {
    waitUntil: "networkidle",
    timeout: 60000,
  });

  await page.waitForTimeout(5000);
  console.log(`Current URL: ${page.url()}`);

  const html = await page.content();
  console.log("HTML length:", html.length);

  // Buscar cualquier cosa que parezca un ID de notebook en el HTML directamente
  const notebookIds = html.match(/notebook\/[a-zA-Z0-9_-]{10,}/g);
  console.log("Found pattern IDs:", notebookIds);

  const notebookData = await page.evaluate(() => {
    // Buscar todos los elementos que contengan texto y ver si están cerca de botones de menú o enlaces
    const elements = Array.from(document.querySelectorAll("*"));
    return elements
      .filter((el) => {
        const text = el.textContent?.trim();
        return (
          text &&
          text.length > 2 &&
          text.length < 50 &&
          el.closest('mat-card, .mat-mdc-card, [role="listitem"]')
        );
      })
      .map((el) => el.textContent?.trim());
  });

  console.log("Potential Names from Card Context:");
  console.log(JSON.stringify([...new Set(notebookData)], null, 2));

  await browser.close();
}

listNotebooks().catch(console.error);
