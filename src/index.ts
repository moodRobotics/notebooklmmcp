#!/usr/bin/env node
import { Command } from 'commander';
import { AuthManager } from './auth.js';
import './server.js'; // This starts the server logic

const program = new Command();

program
  .name('notebooklm-mcp-server')
  .description('NotebookLM MCP Server (Node.js)')
  .version('1.0.6');

program
  .command('server')
  .description('Start the MCP server (default)')
  .action(() => {
    import('./server.js');
  });

program
  .command('auth')
  .description('Run interactive authentication')
  .action(async () => {
    const { runAuthCli } = await import('./auth-cli.js');
    await runAuthCli();
  });

// Default to server if no command provided
if (!process.argv.slice(2).length || !['auth', 'server', '--version', '-h', '--help'].includes(process.argv[2])) {
  import('./server.js');
} else {
  program.parse();
}
