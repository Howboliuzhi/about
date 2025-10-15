import React, { useState, useCallback } from 'react';
import { getAuthenticatedUser, createRepo, createRepoSecret, createOrUpdateFile, WORKFLOW_CONTENT } from './services/githubService';
import { type LogEntry, LogStatus } from './types';
import { GithubIcon, LoaderIcon, CheckCircleIcon, XCircleIcon, RocketIcon, DotIcon } from './components/icons';

const App: React.FC = () => {
  const [pat, setPat] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const addLog = useCallback((message: string, status: LogStatus) => {
    setLogs(prev => [...prev, { message, status, key: Date.now() + Math.random() }]);
  }, []);

  const updateLastLog = useCallback((message: string, status: LogStatus) => {
    setLogs(prev => {
      if (prev.length === 0) return prev;
      const newLogs = [...prev];
      const lastLog = { ...newLogs[newLogs.length - 1], message, status };
      newLogs[newLogs.length - 1] = lastLog;
      return newLogs;
    });
  }, []);

  const handleStart = async () => {
    if (!pat) {
      addLog('Personal Access Token cannot be empty.', 'error');
      return;
    }
    setIsLoading(true);
    setLogs([]);
    const repoName = 'app';
    const filePath = '.github/workflows/auto-run.yml';
    const commitMessage = 'Add CI/CD workflow';

    try {
      addLog('Verifying Personal Access Token...', 'pending');
      const username = await getAuthenticatedUser(pat);
      updateLastLog(`Token verified. Logged in as ${username}`, 'success');

      await sleep(3000);

      addLog(`Creating repository "${username}/${repoName}"...`, 'pending');
      await createRepo(pat, repoName);
      updateLastLog(`Repository "${username}/${repoName}" created successfully.`, 'success');

      await sleep(3000);
      
      addLog('Creating repository secret (DELETE_TOKEN)...', 'pending');
      await createRepoSecret(pat, username, repoName, 'DELETE_TOKEN', pat);
      updateLastLog('Secret DELETE_TOKEN created successfully.', 'success');

      await sleep(3000);

      addLog(`Committing workflow file to repository...`, 'pending');
      await createOrUpdateFile(pat, username, repoName, filePath, WORKFLOW_CONTENT, commitMessage);
      updateLastLog('Workflow file committed successfully!', 'success');

      await sleep(1000);
      addLog('Automation complete! Your workflow is ready.', 'final');

    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message || 'An unknown error occurred.';
      updateLastLog(`Error: ${errorMessage}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const getStatusIcon = (status: LogStatus) => {
    switch (status) {
      case 'pending':
        return <LoaderIcon className="animate-spin h-5 w-5 text-blue-400" />;
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-400" />;
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-400" />;
      case 'final':
        return <RocketIcon className="h-5 w-5 text-purple-400" />;
      default:
        return <DotIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl bg-gray-800 border border-gray-700 rounded-2xl shadow-lg p-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center items-center gap-4">
            <GithubIcon className="h-10 w-10 text-white" />
            <h1 className="text-4xl font-bold text-white tracking-tight">GitHub Automation</h1>
          </div>
          <p className="text-gray-400">Create a repository and deploy a workflow with one click.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="pat" className="block text-sm font-medium text-gray-300 mb-2">
              GitHub Personal Access Token (PAT)
            </label>
            <input
              id="pat"
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
              disabled={isLoading}
            />
          </div>
          <button
            onClick={handleStart}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center transition-all duration-300 transform hover:scale-105 disabled:scale-100"
          >
            {isLoading ? (
              <>
                <LoaderIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                Processing...
              </>
            ) : (
              'Start Automation'
            )}
          </button>
        </div>

        {logs.length > 0 && (
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 space-y-3 h-64 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.key} className="flex items-start gap-3">
                <div className="flex-shrink-0 pt-0.5">{getStatusIcon(log.status)}</div>
                <p className={`text-sm ${log.status === 'error' ? 'text-red-400' : 'text-gray-300'}`}>{log.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <footer className="text-center mt-8 text-gray-500 text-sm">
        <p>Your Personal Access Token is used only for API requests and is not stored.</p>
      </footer>
    </div>
  );
};

export default App;