import { NotebookLMClient } from '../src/client.js';
import { AuthManager } from '../src/auth.js';
import chalk from 'chalk';
import path from 'path';

/**
 * This example shows how to add local files and basic notebook management.
 */
async function runLocalFileExample() {
  const auth = new AuthManager();
  const cookies = auth.getSavedCookies();

  if (!cookies) {
    console.error(chalk.red('Error: No cookies found. Run "npm run auth" first.'));
    process.exit(1);
  }

  const client = new NotebookLMClient(cookies);

  try {
    const notebooks = await client.listNotebooks();
    console.log(chalk.cyan(`Found ${notebooks.length} notebooks.`));

    // Create a temporary notebook for this example
    const notebookId = await client.createNotebook('Local File Test');
    console.log(chalk.green(`✓ Created test notebook: ${notebookId}`));

    // Add a local text source (assuming README.md exists)
    const readmePath = path.resolve('../README.md');
    console.log(chalk.cyan(`\nUploading local file: ${readmePath}...`));
    const sourceId = await client.uploadLocalFile(notebookId, readmePath);
    console.log(chalk.green(`✓ File uploaded. Source ID: ${sourceId}`));

    // Add a YouTube transcript
    const ytUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    console.log(chalk.cyan(`\nAdding YouTube source: ${ytUrl}...`));
    const ytSourceId = await client.addUrlSource(notebookId, ytUrl);
    console.log(chalk.green(`✓ YouTube source added. ID: ${ytSourceId}`));

    console.log(chalk.yellow('\nListing sources in notebook...'));
    // We can use listNotebooks to see counts or just query
    const response = await client.query(notebookId, 'What is this notebook about?');
    console.log(chalk.blue.bold('\nAI Summary:'));
    console.log(response.answer);

    // Clean up
    // await client.deleteNotebook(notebookId);
    // console.log(chalk.gray('\nNotebook deleted.'));

  } catch (error: any) {
    console.error(chalk.red('\nError:'), error.message);
  }
}

runLocalFileExample();
