import { NotebookLMClient } from '../src/client.js';
import { AuthManager } from '../src/auth.js';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

/**
 * This example demonstrates a full creative workflow:
 * 1. Initialize client and check authentication.
 * 2. Create a new notebook for a specific topic.
 * 3. Start a Deep Research task on the web.
 * 4. Poll and wait for research completion.
 * 5. Import the discovered sources into the notebook.
 * 6. Generate an Audio Overview (podcast).
 */
async function runFullWorkflow() {
  const auth = new AuthManager();
  const cookies = process.env.NOTEBOOKLM_COOKIES || auth.getSavedCookies();

  if (!cookies) {
    console.error(chalk.red('Error: No cookies found. Run "npm run auth" first.'));
    process.exit(1);
  }

  const client = new NotebookLMClient(cookies);

  try {
    console.log(chalk.cyan('Step 1: Creating a new notebook...'));
    const notebookTitle = `AI Research: ${new Date().toLocaleDateString()}`;
    const notebookId = await client.createNotebook(notebookTitle);
    console.log(chalk.green(`✓ Notebook created: ${notebookTitle} (${notebookId})`));

    console.log(chalk.cyan('\nStep 2: Starting Deep Research on "Future of Agentic AI"...'));
    const research = await client.startResearch(notebookId, 'Future of Agentic AI and MCP protocol', 'web', 'deep');
    const taskId = research.task_id;
    console.log(chalk.green(`✓ Research task started. Task ID: ${taskId}`));

    console.log(chalk.yellow('\nStep 3: Polling for research results (this may take a minute)...'));
    let completed = false;
    let researchData: any = null;

    while (!completed) {
      researchData = await client.pollResearch(notebookId);
      if (researchData && researchData.status === 'completed') {
        completed = true;
        console.log(chalk.green('✓ Research completed!'));
      } else {
        process.stdout.write('.');
        await new Promise(r => setTimeout(r, 5000)); // Wait 5s
      }
    }

    console.log(chalk.cyan('\nStep 4: Importing discovered sources...'));
    if (researchData.sources && researchData.sources.length > 0) {
      const imported = await client.importResearchSources(notebookId, taskId, researchData.sources);
      console.log(chalk.green(`✓ Successfully imported ${imported.length} sources.`));
    }

    console.log(chalk.cyan('\nStep 5: Generating Audio Overview (Podcast)...'));
    await client.createAudioOverview(notebookId, []); // [] means all sources
    console.log(chalk.green('✓ Audio generation triggered.'));

    console.log(chalk.cyan('\nStep 6: Asking a final summary question...'));
    const response = await client.query(notebookId, 'Summarize the top 3 insights from the research.');
    console.log(chalk.blue.bold('\nAI Response:'));
    console.log(response.answer);

    console.log(chalk.magenta.bold('\n--- Workflow Finished Successfully ---'));
    console.log(`Open your notebook here: https://notebooklm.google.com/notebook/${notebookId}`);

  } catch (error: any) {
    console.error(chalk.red('\nWorkflow failed:'), error.message);
  }
}

runFullWorkflow();
