#!/usr/bin/env node
import { AuthManager } from './auth.js';
import chalk from 'chalk';
import ora from 'ora';

export async function runAuthCli() {
  const auth = new AuthManager();
  console.log('\n' + chalk.cyan.bold('╔═══════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║      NotebookLM MCP Authentication        ║'));
  console.log(chalk.cyan.bold('╚═══════════════════════════════════════════╝\n'));

  const spinner = ora('Initializing browser...').start();
  
  try {
    await auth.runAuthentication((status) => {
      spinner.text = status;
    });
    spinner.succeed(chalk.green.bold('Authentication successful!'));
    console.log('\n' + chalk.white('Your session is now active. You can use the server with your favorite MCP client.'));
  } catch (error: any) {
    spinner.fail(chalk.red.bold('Authentication failed'));
    console.error('\n' + chalk.red('Error: ') + error.message);
    process.exit(1);
  }
}

// Only run automatically if this is the main module
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAuthCli();
}
