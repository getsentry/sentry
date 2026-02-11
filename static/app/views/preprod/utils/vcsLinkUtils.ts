interface VcsInfo {
  base_ref?: string | null;
  base_repo_name?: string | null;
  base_sha?: string | null;
  head_ref?: string | null;
  head_repo_name?: string | null;
  head_sha?: string | null;
  pr_number?: number | null;
  provider?: string | null;
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
  sha: string | null | undefined,
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
  branch: string | null | undefined,
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
  repoName: string | null | undefined
): string | null {
  if (!vcsInfo.provider || !repoName || repoName === '-') {
    return null;
  }

  const baseUrl = getBaseUrl(vcsInfo.provider, repoName);
  return baseUrl || null;
}

export function getCheckRunUrl(
  vcsInfo: VcsInfo,
  checkId: string | null | undefined
): string | null {
  if (!vcsInfo.provider || !checkId || !vcsInfo.head_repo_name) {
    return null;
  }

  const baseUrl = getBaseUrl(vcsInfo.provider, vcsInfo.head_repo_name);
  if (!baseUrl) {
    return null;
  }

  switch (vcsInfo.provider) {
    case 'github':
      return `${baseUrl}/runs/${checkId}`;
    default:
      return null;
  }
}
