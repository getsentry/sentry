interface VcsInfo {
  base_ref?: string;
  base_repo_name?: string;
  base_sha?: string;
  head_ref?: string;
  head_repo_name?: string;
  head_sha?: string;
  pr_number?: number;
  provider?: 'github' | 'github_enterprise' | 'gitlab' | 'bitbucket' | 'bitbucket_server';
}

function getBaseUrl(provider: string, repoName: string): string {
  switch (provider) {
    case 'github':
      return `https://github.com/${repoName}`;
    case 'github_enterprise':
      // For enterprise, we'd need the custom domain which isn't available in the data
      // Fall back to generic GitHub for now
      return `https://github.com/${repoName}`;
    case 'gitlab':
      return `https://gitlab.com/${repoName}`;
    case 'bitbucket':
      return `https://bitbucket.org/${repoName}`;
    case 'bitbucket_server':
      // For Bitbucket Server, we'd need the custom domain which isn't available
      // Fall back to generic Bitbucket for now
      return `https://bitbucket.org/${repoName}`;
    default:
      return '';
  }
}

export function getShaUrl(
  vcsInfo: VcsInfo,
  sha: string,
  isBaseSha = false
): string | null {
  if (!vcsInfo.provider || !sha || sha === '-') {
    return null;
  }

  const repoName = isBaseSha
    ? vcsInfo.base_repo_name || vcsInfo.head_repo_name
    : vcsInfo.head_repo_name;
  if (!repoName) {
    return null;
  }

  const baseUrl = getBaseUrl(vcsInfo.provider, repoName);
  if (!baseUrl) {
    return null;
  }

  switch (vcsInfo.provider) {
    case 'github':
    case 'github_enterprise':
      return `${baseUrl}/commit/${sha}`;
    case 'gitlab':
      return `${baseUrl}/-/commit/${sha}`;
    case 'bitbucket':
    case 'bitbucket_server':
      return `${baseUrl}/commits/${sha}`;
    default:
      return null;
  }
}

export function getPrUrl(vcsInfo: VcsInfo): string | null {
  if (!vcsInfo.provider || !vcsInfo.pr_number || !vcsInfo.head_repo_name) {
    return null;
  }

  const baseUrl = getBaseUrl(vcsInfo.provider, vcsInfo.head_repo_name);
  if (!baseUrl) {
    return null;
  }

  switch (vcsInfo.provider) {
    case 'github':
    case 'github_enterprise':
      return `${baseUrl}/pull/${vcsInfo.pr_number}`;
    case 'gitlab':
      return `${baseUrl}/-/merge_requests/${vcsInfo.pr_number}`;
    case 'bitbucket':
    case 'bitbucket_server':
      return `${baseUrl}/pull-requests/${vcsInfo.pr_number}`;
    default:
      return null;
  }
}

export function getBranchUrl(
  vcsInfo: VcsInfo,
  branch: string,
  isBaseBranch = false
): string | null {
  if (!vcsInfo.provider || !branch || branch === '-') {
    return null;
  }

  const repoName = isBaseBranch
    ? vcsInfo.base_repo_name || vcsInfo.head_repo_name
    : vcsInfo.head_repo_name;
  if (!repoName) {
    return null;
  }

  const baseUrl = getBaseUrl(vcsInfo.provider, repoName);
  if (!baseUrl) {
    return null;
  }

  switch (vcsInfo.provider) {
    case 'github':
    case 'github_enterprise':
      return `${baseUrl}/tree/${branch}`;
    case 'gitlab':
      return `${baseUrl}/-/tree/${branch}`;
    case 'bitbucket':
    case 'bitbucket_server':
      return `${baseUrl}/src/${branch}`;
    default:
      return null;
  }
}

export function getRepoUrl(vcsInfo: VcsInfo, repoName: string): string | null {
  if (!vcsInfo.provider || !repoName || repoName === '-') {
    return null;
  }

  const baseUrl = getBaseUrl(vcsInfo.provider, repoName);
  return baseUrl || null;
}
