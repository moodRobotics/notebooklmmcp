import axios from 'axios';
import { execSync } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function checkForUpdates(silentStart = true) {
  try {
    // Get current version from package.json
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const currentVersion = pkg.version;

    if (!silentStart) {
      console.error(chalk.blue(`[v${currentVersion}] Comprobando actualizaciones...`));
    }

    // Get latest version from npm
    const { data } = await axios.get('https://registry.npmjs.org/notebooklm-mcp-server/latest', { timeout: 3000 });
    const latestVersion = data.version;

    if (latestVersion !== currentVersion) {
      console.error(chalk.yellow(`\n[Update] ¡Nueva versión disponible! (${latestVersion})`));
      console.error(chalk.yellow(`[Update] Actualizando automáticamente...\n`));

      try {
        execSync('npm install -g notebooklm-mcp-server@latest', { stdio: ['ignore', 'ignore', 'inherit'] });
        console.error(chalk.green('[Update] Actualización completada. Por favor, reinicia la aplicación.\n'));
        process.exit(0);
      } catch (updateError) {
        console.error(chalk.red('[Update] Error al actualizar automáticamente.'));
      }
    } else if (!silentStart) {
      console.error(chalk.green(`[v${currentVersion}] Estás usando la última versión.`));
    }
  } catch (error) {
    // Fail silently
  }
}
