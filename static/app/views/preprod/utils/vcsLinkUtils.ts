interface VcsInfo {
  base_ref?: string;
  base_repo_name?: string;
  base_sha?: string;
  head_ref?: string;
  head_repo_name?: string;
  head_sha?: string;
  pr_number?: number;
  provider?: 'github';
}

function getBaseUrl(provider: string, repoName: string): string | null {
  switch (provider) {
    case 'github':
      return `https://github.com/${repoName}`;
    default:
      return null;
  }
}

export function getShaUrl(
  vcsInfo: VcsInfo,
  sha: string | undefined,
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
      return `${baseUrl}/commit/${sha}`;
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
      return `${baseUrl}/pull/${vcsInfo.pr_number}`;
    default:
      return null;
  }
}

export function getBranchUrl(
  vcsInfo: VcsInfo,
  branch: string | undefined,
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
      return `${baseUrl}/tree/${branch}`;
    default:
      return null;
  }
}

export function getRepoUrl(
  vcsInfo: VcsInfo,
  repoName: string | undefined
): string | null {
  if (!vcsInfo.provider || !repoName || repoName === '-') {
    return null;
  }

  const baseUrl = getBaseUrl(vcsInfo.provider, repoName);
  return baseUrl || null;
}
