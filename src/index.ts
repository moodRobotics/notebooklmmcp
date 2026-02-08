#!/usr/bin/env node
import { Command } from 'commander';
import { AuthManager } from './auth.js';
import { checkForUpdates } from './update.js';

const program = new Command();

program
  .name('notebooklm-mcp-server')
  .description('NotebookLM MCP Server (Node.js)')
  .version('3.0.0');

program
  .command('server')
  .description('Start the MCP server (default)')
  .action(async () => {
    await checkForUpdates(true);
    await import('./server.js');
  });

program
  .command('auth')
  .description('Run interactive authentication')
  .action(async () => {
    await checkForUpdates(false);
    const { runAuthCli } = await import('./auth-cli.js');
    await runAuthCli();
  });

// Default to server if no command provided
const args = process.argv.slice(2);
if (!args.length || !['auth', 'server', '--version', '-h', '--help'].includes(args[0])) {
  // If no args or unknown command, start server
  (async () => {
    await checkForUpdates();
    import('./server.js');
  })();
} else {
  program.parse();
}
