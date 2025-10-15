import { getAuthenticatedUser, createRepo, createRepoSecret, createOrUpdateFile, WORKFLOW_CONTENT } from '../services/githubService';

const pat = process.env.GITHUB_PAT;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const log = (message: string) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
};

const runAutomation = async () => {
    if (!pat) {
        log('Error: GITHUB_PAT environment variable is not set.');
        // FIX: Access `process` via `globalThis` to avoid TypeScript errors when Node.js types are not available.
        (globalThis as any).process.exit(1);
    }

    log('Starting GitHub Automation...');
    const repoName = 'app';
    const filePath = '.github/workflows/auto-run.yml';
    const commitMessage = 'Add CI/CD workflow';

    try {
        log('Verifying Personal Access Token...');
        const username = await getAuthenticatedUser(pat);
        log(`Token verified. Logged in as ${username}`);

        await sleep(1000);

        log(`Creating repository "${username}/${repoName}"...`);
        await createRepo(pat, repoName);
        log(`Repository "${username}/${repoName}" created successfully.`);

        await sleep(1000);

        log('Creating repository secret (DELETE_TOKEN)...');
        await createRepoSecret(pat, username, repoName, 'DELETE_TOKEN', pat);
        log('Secret DELETE_TOKEN created successfully.');

        await sleep(1000);

        log(`Committing workflow file to repository...`);
        await createOrUpdateFile(pat, username, repoName, filePath, WORKFLOW_CONTENT, commitMessage);
        log('Workflow file committed successfully!');

        await sleep(1000);
        log('✅ Automation complete! Your workflow is ready.');

    } catch (error: any) {
        const errorMessage = error.message || 'An unknown error occurred.';
        log(`❌ Error: ${errorMessage}`);
        // FIX: Access `process` via `globalThis` to avoid TypeScript errors when Node.js types are not available.
        (globalThis as any).process.exit(1);
    }
};

runAutomation();