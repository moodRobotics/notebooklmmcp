import axios from 'axios';
import { execSync, spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * On Windows, native .node files (e.g. @napi-rs/canvas) are locked by the
 * running process, so `npm install -g` fails with EPERM when trying to
 * overwrite them.  We work around this by spawning a detached helper script
 * that waits for the current process to exit, performs the update, and then
 * relaunches the application.
 */
function updateOnWindows(args: string[]): Promise<never> {
  const argsStr = args.map(a => `"${a}"`).join(' ');
  const nodeExe = process.argv[0];
  const pid = process.pid;

  // Batch script that:
  //  1. Waits for the current process (by PID) to terminate
  //  2. Runs npm install -g
  //  3. Relaunches with the same arguments
  //  4. Deletes itself
  const script = [
    '@echo off',
    `echo [Update] Esperando a que el proceso anterior (PID ${pid}) finalice...`,
    // tasklist loop: wait until PID disappears — polls every 1 s
    `:waitloop`,
    `tasklist /FI "PID eq ${pid}" 2>NUL | find /I "${pid}" >NUL`,
    `if not errorlevel 1 (`,
    `  timeout /t 1 /nobreak >NUL`,
    `  goto waitloop`,
    `)`,
    `echo [Update] Instalando actualizacion...`,
    `npm install -g notebooklm-mcp-server@latest`,
    `echo [Update] Relanzando aplicacion...`,
    `"${nodeExe}" ${argsStr}`,
    `del "%~f0"`,
  ].join('\r\n');

  const tmpScript = path.join(os.tmpdir(), `notebooklm-update-${pid}.cmd`);
  fs.writeFileSync(tmpScript, script, 'utf8');

  // Spawn the script detached so it survives our exit
  const child = spawn('cmd.exe', ['/c', tmpScript], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();

  console.error(chalk.green('[Update] La actualización se completará en segundo plano.'));
  console.error(chalk.cyan('[Update] El servidor se relanzará automáticamente.\n'));

  // Exit the current process so files are unlocked
  process.exit(0);
}

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
      console.error(chalk.yellow(`[Update] Actualizando y relanzando automáticamente...\n`));

      try {
        if (process.platform === 'win32') {
          // On Windows, delegate to a detached helper to avoid EPERM on locked native modules
          return updateOnWindows(process.argv.slice(1));
        }

        // Non-Windows: update in-process (native files are not locked on Unix)
        execSync('npm install -g notebooklm-mcp-server@latest', { stdio: ['ignore', 'ignore', 'inherit'] });
        
        console.error(chalk.green('[Update] Actualización completada con éxito.'));
        console.error(chalk.cyan('[Update] Relanzando aplicación...\n'));

        // Relaunch the process with the same arguments
        const args = process.argv.slice(1);
        const child = spawn(process.argv[0], args, {
          stdio: 'inherit',
          detached: false
        });

        child.on('exit', (code) => {
          process.exit(code || 0);
        });

        return new Promise(() => {}); // Never resolve, wait child
      } catch (updateError) {
        console.error(chalk.red('[Update] Error al actualizar automáticamente. Por favor, reinicia manualmente.'));
      }
    } else if (!silentStart) {
      console.error(chalk.green(`[v${currentVersion}] Estás usando la última versión.`));
    }
  } catch (error) {
    // Fail silently
  }
}
