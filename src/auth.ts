import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

export class AuthManager {
  private authPath: string;

  constructor() {
    this.authPath = path.join(os.homedir(), '.notebooklm-mcp', 'auth.json');
  }

  async runAuthentication(onStatus?: (status: string) => void): Promise<void> {
    if (onStatus) onStatus('Launching Chromium...');
    
    const browser = await chromium.launch({ 
      headless: false,
      args: ['--disable-blink-features=AutomationControlled']
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    if (onStatus) onStatus('Loading NotebookLM...');
    await page.goto('https://notebooklm.google.com');

    if (onStatus) onStatus('Waiting for Google Login...');
    
    // Wait for the user to be logged in and redirected to the main app
    try {
      await page.waitForURL('**/notebook/**', { timeout: 300000 }); // 5 minute timeout
    } catch (e) {
      await browser.close();
      throw new Error('Authentication timed out or browser was closed.');
    }

    if (onStatus) onStatus('Extracting secure session cookies...');
    const cookies = await context.cookies();
    const cookieString = cookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ');

    const authData = {
      cookies: cookieString,
      updatedAt: new Date().toISOString()
    };

    if (!fs.existsSync(path.dirname(this.authPath))) {
      fs.mkdirSync(path.dirname(this.authPath), { recursive: true });
    }

    fs.writeFileSync(this.authPath, JSON.stringify(authData, null, 2));
    
    console.log(`Authentication successful! Cookies saved to ${this.authPath}`);
    await browser.close();
  }

  getSavedCookies(): string {
    if (!fs.existsSync(this.authPath)) {
      throw new Error('Authentication required. Please run notebook-mcp-auth');
    }
    const data = JSON.parse(fs.readFileSync(this.authPath, 'utf-8'));
    return data.cookies;
  }
}
