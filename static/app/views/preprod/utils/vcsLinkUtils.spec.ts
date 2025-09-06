import {getBranchUrl, getPrUrl, getRepoUrl, getShaUrl} from './vcsLinkUtils';

describe('VCS Link Utils', () => {
  const mockVcsInfo = {
    head_sha: 'abc123',
    base_sha: 'def456',
    head_ref: 'feature-branch',
    base_ref: 'main',
    head_repo_name: 'owner/repo',
    base_repo_name: 'upstream/repo',
    pr_number: 42,
    provider: 'github' as const,
  };

  describe('getShaUrl', () => {
    it('returns correct GitHub URL for head SHA', () => {
      const url = getShaUrl(mockVcsInfo, mockVcsInfo.head_sha);
      expect(url).toBe('https://github.com/owner/repo/commit/abc123');
    });

    it('returns correct GitHub URL for base SHA', () => {
      const url = getShaUrl(mockVcsInfo, mockVcsInfo.base_sha, true);
      expect(url).toBe('https://github.com/upstream/repo/commit/def456');
    });

    it('returns correct GitLab URL', () => {
      const gitlabVcsInfo = {...mockVcsInfo, provider: 'gitlab' as const};
      const url = getShaUrl(gitlabVcsInfo, mockVcsInfo.head_sha);
      expect(url).toBe('https://gitlab.com/owner/repo/-/commit/abc123');
    });

    it('returns correct Bitbucket URL', () => {
      const bitbucketVcsInfo = {...mockVcsInfo, provider: 'bitbucket' as const};
      const url = getShaUrl(bitbucketVcsInfo, mockVcsInfo.head_sha);
      expect(url).toBe('https://bitbucket.org/owner/repo/commits/abc123');
    });

    it('returns null for invalid SHA', () => {
      const url = getShaUrl(mockVcsInfo, '');
      expect(url).toBeNull();
    });

    it('returns null for missing provider', () => {
      const vcsInfoNoProvider = {...mockVcsInfo, provider: undefined};
      const url = getShaUrl(vcsInfoNoProvider, mockVcsInfo.head_sha);
      expect(url).toBeNull();
    });
  });

  describe('getPrUrl', () => {
    it('returns correct GitHub PR URL', () => {
      const url = getPrUrl(mockVcsInfo);
      expect(url).toBe('https://github.com/owner/repo/pull/42');
    });

    it('returns correct GitLab MR URL', () => {
      const gitlabVcsInfo = {...mockVcsInfo, provider: 'gitlab' as const};
      const url = getPrUrl(gitlabVcsInfo);
      expect(url).toBe('https://gitlab.com/owner/repo/-/merge_requests/42');
    });

    it('returns correct Bitbucket PR URL', () => {
      const bitbucketVcsInfo = {...mockVcsInfo, provider: 'bitbucket' as const};
      const url = getPrUrl(bitbucketVcsInfo);
      expect(url).toBe('https://bitbucket.org/owner/repo/pull-requests/42');
    });

    it('returns null for missing PR number', () => {
      const vcsInfoNoPr = {...mockVcsInfo, pr_number: undefined};
      const url = getPrUrl(vcsInfoNoPr);
      expect(url).toBeNull();
    });
  });

  describe('getBranchUrl', () => {
    it('returns correct GitHub branch URL', () => {
      const url = getBranchUrl(mockVcsInfo, mockVcsInfo.head_ref);
      expect(url).toBe('https://github.com/owner/repo/tree/feature-branch');
    });

    it('returns correct GitLab branch URL', () => {
      const gitlabVcsInfo = {...mockVcsInfo, provider: 'gitlab' as const};
      const url = getBranchUrl(gitlabVcsInfo, mockVcsInfo.head_ref);
      expect(url).toBe('https://gitlab.com/owner/repo/-/tree/feature-branch');
    });

    it('returns correct Bitbucket branch URL', () => {
      const bitbucketVcsInfo = {...mockVcsInfo, provider: 'bitbucket' as const};
      const url = getBranchUrl(bitbucketVcsInfo, mockVcsInfo.head_ref);
      expect(url).toBe('https://bitbucket.org/owner/repo/src/feature-branch');
    });

    it('returns null for empty branch', () => {
      const url = getBranchUrl(mockVcsInfo, '');
      expect(url).toBeNull();
    });
  });

  describe('getRepoUrl', () => {
    it('returns correct GitHub repo URL', () => {
      const url = getRepoUrl(mockVcsInfo, mockVcsInfo.head_repo_name);
      expect(url).toBe('https://github.com/owner/repo');
    });

    it('returns correct GitLab repo URL', () => {
      const gitlabVcsInfo = {...mockVcsInfo, provider: 'gitlab' as const};
      const url = getRepoUrl(gitlabVcsInfo, mockVcsInfo.head_repo_name);
      expect(url).toBe('https://gitlab.com/owner/repo');
    });

    it('returns correct Bitbucket repo URL', () => {
      const bitbucketVcsInfo = {...mockVcsInfo, provider: 'bitbucket' as const};
      const url = getRepoUrl(bitbucketVcsInfo, mockVcsInfo.head_repo_name);
      expect(url).toBe('https://bitbucket.org/owner/repo');
    });

    it('returns null for empty repo name', () => {
      const url = getRepoUrl(mockVcsInfo, '');
      expect(url).toBeNull();
    });
  });
});
