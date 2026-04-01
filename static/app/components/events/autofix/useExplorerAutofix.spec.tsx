import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {DiffFileType, DiffLineType} from 'sentry/components/events/autofix/types';
import {
  collectPatches,
  isCodeChangesArtifact,
  isCodingAgentsArtifact,
  isPullRequestsArtifact,
  isRootCauseArtifact,
  isSolutionArtifact,
  useExplorerAutofix,
  type RootCauseArtifact,
  type SolutionArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {Artifact, ExplorerFilePatch} from 'sentry/views/seerExplorer/types';

jest.mock('sentry/actionCreators/indicator');

function makeValidArtifact<T>(data: T): Artifact<T> {
  return {
    key: 'artifact-1',
    reason: 'Found a root cause',
    data,
  };
}

describe('isRootCauseArtifact', () => {
  function makeValidRootCauseData(): RootCauseArtifact {
    return {
      one_line_description: 'Null pointer in handler',
      five_whys: ['Why 1', 'Why 2'],
      reproduction_steps: ['Step 1', 'Step 2'],
    };
  }

  it('returns true for a valid RootCauseArtifact', () => {
    expect(isRootCauseArtifact(makeValidArtifact(makeValidRootCauseData()))).toBe(true);
  });

  it('returns false for non-artifact objects', () => {
    expect(isRootCauseArtifact(null)).toBe(false);
    expect(isRootCauseArtifact({data: makeValidRootCauseData()})).toBe(false);
    expect(isRootCauseArtifact({key: 'k', data: makeValidRootCauseData()})).toBe(false);
  });

  it('returns false when data is null', () => {
    expect(isRootCauseArtifact({key: 'k', reason: 'r', data: null})).toBe(false);
  });

  it('returns false when data has wrong types', () => {
    expect(
      isRootCauseArtifact(
        makeValidArtifact({
          one_line_description: 'ok',
          five_whys: [1, 2],
          reproduction_steps: ['Step 1'],
        })
      )
    ).toBe(false);

    expect(
      isRootCauseArtifact(
        makeValidArtifact({
          one_line_description: 123,
          five_whys: ['Why'],
          reproduction_steps: ['Step'],
        })
      )
    ).toBe(false);
  });
});

describe('isSolutionArtifact', () => {
  function makeValidSolutionData(): SolutionArtifact {
    return {
      one_line_summary: 'Fix the null check',
      steps: [{title: 'Step 1', description: 'Do the thing'}],
    };
  }

  it('returns true for a valid SolutionArtifact', () => {
    expect(isSolutionArtifact(makeValidArtifact(makeValidSolutionData()))).toBe(true);
  });

  it('returns false for non-artifact objects', () => {
    expect(isSolutionArtifact(null)).toBe(false);
    expect(isSolutionArtifact({data: makeValidSolutionData()})).toBe(false);
  });

  it('returns false when data is null', () => {
    expect(isSolutionArtifact({key: 'k', reason: 'r', data: null})).toBe(false);
  });

  it('returns false when steps contains invalid objects', () => {
    expect(
      isSolutionArtifact(
        makeValidArtifact({
          one_line_summary: 'Fix it',
          steps: [{title: 'Missing description'}],
        })
      )
    ).toBe(false);

    expect(
      isSolutionArtifact(
        makeValidArtifact({
          one_line_summary: 'Fix it',
          steps: [{description: 'Missing title'}],
        })
      )
    ).toBe(false);
  });

  it('returns true when steps is an empty array', () => {
    expect(
      isSolutionArtifact(
        makeValidArtifact({
          one_line_summary: 'Fix it',
          steps: [],
        })
      )
    ).toBe(true);
  });
});

describe('isCodeChangesArtifact', () => {
  function makeValidFilePatch() {
    return {
      repo_name: 'org/repo',
      diff: '--- a/file.py\n+++ b/file.py',
      patch: {
        path: 'file.py',
        added: 1,
        removed: 0,
        hunks: [
          {
            lines: [
              {
                diff_line_no: 1,
                line_type: DiffLineType.ADDED,
                source_line_no: null,
                target_line_no: 1,
                value: '+hello',
              },
            ],
            section_header: '@@ -1,3 +1,4 @@',
            source_length: 3,
            source_start: 1,
            target_length: 4,
            target_start: 1,
          },
        ],
        source_file: 'a/file.py',
        target_file: 'b/file.py',
        type: DiffFileType.MODIFIED,
      },
    };
  }

  it('returns true for a valid file patch array', () => {
    expect(isCodeChangesArtifact([makeValidFilePatch()])).toBe(true);
  });

  it('returns false for an empty array', () => {
    expect(isCodeChangesArtifact([])).toBe(false);
  });

  it('returns false for non-array values', () => {
    expect(isCodeChangesArtifact(null)).toBe(false);
    expect(isCodeChangesArtifact('string')).toBe(false);
    expect(isCodeChangesArtifact({repo_name: 'org/repo'})).toBe(false);
  });

  it('returns false when array contains invalid items', () => {
    expect(isCodeChangesArtifact([{repo_name: 'org/repo'}])).toBe(false);
  });
});

describe('isPullRequestsArtifact', () => {
  function makeValidPR() {
    return {
      repo_name: 'org/repo',
      branch_name: 'fix/bug',
      commit_sha: 'abc123',
      pr_creation_error: null,
      pr_creation_status: 'completed',
      pr_id: 1,
      pr_number: 42,
      pr_url: 'https://github.com/org/repo/pull/42',
      title: 'Fix bug',
    };
  }

  it('returns true for a valid PR state array', () => {
    expect(isPullRequestsArtifact([makeValidPR()])).toBe(true);
  });

  it('returns false for an empty array', () => {
    expect(isPullRequestsArtifact([])).toBe(false);
  });

  it('returns false for non-array values', () => {
    expect(isPullRequestsArtifact(null)).toBe(false);
    expect(isPullRequestsArtifact('string')).toBe(false);
    expect(isPullRequestsArtifact({repo_name: 'org/repo'})).toBe(false);
  });

  it('returns false when array contains invalid items', () => {
    expect(isPullRequestsArtifact([{not_a: 'pr'}])).toBe(false);
  });
});

describe('isCodingAgentsArtifact', () => {
  function makeValidCodingAgent() {
    return {
      id: 'agent-1',
      name: 'My Agent',
      provider: 'cursor_background_agent',
      started_at: '2026-01-01T00:00:00Z',
      status: 'running',
    };
  }

  it('returns true for a valid coding agent array', () => {
    expect(isCodingAgentsArtifact([makeValidCodingAgent()])).toBe(true);
  });

  it('returns false for an empty array', () => {
    expect(isCodingAgentsArtifact([])).toBe(false);
  });

  it('returns false for non-array values', () => {
    expect(isCodingAgentsArtifact(null)).toBe(false);
    expect(isCodingAgentsArtifact('string')).toBe(false);
    expect(isCodingAgentsArtifact({id: 'agent-1'})).toBe(false);
  });

  it('returns false when array contains invalid items', () => {
    expect(isCodingAgentsArtifact([{not_an: 'agent'}])).toBe(false);
  });
});

describe('collectPatches', () => {
  function makePatch(
    overrides: Partial<ExplorerFilePatch> & {repo_name: string}
  ): ExplorerFilePatch {
    return {
      diff: 'diff content',
      patch: {
        added: 1,
        removed: 0,
        path: 'file.py',
        source_file: 'file.py',
        target_file: 'file.py',
        type: DiffFileType.MODIFIED,
        hunks: [],
      },
      ...overrides,
    };
  }

  it('returns an empty map for empty input', () => {
    expect(collectPatches([])).toEqual(new Map());
  });

  it('returns a single patch grouped by repo', () => {
    const patch = makePatch({repo_name: 'owner/repo'});
    const result = collectPatches([patch]);

    expect(result.size).toBe(1);
    expect(result.get('owner/repo')).toEqual([patch]);
  });

  it('groups multiple patches in the same repo', () => {
    const patch1 = makePatch({
      repo_name: 'owner/repo',
      patch: {
        added: 1,
        removed: 0,
        path: 'a.py',
        source_file: 'a.py',
        target_file: 'a.py',
        type: DiffFileType.MODIFIED,
        hunks: [],
      },
    });
    const patch2 = makePatch({
      repo_name: 'owner/repo',
      patch: {
        added: 2,
        removed: 1,
        path: 'b.py',
        source_file: 'b.py',
        target_file: 'b.py',
        type: DiffFileType.MODIFIED,
        hunks: [],
      },
    });

    const result = collectPatches([patch1, patch2]);

    expect(result.size).toBe(1);
    expect(result.get('owner/repo')).toEqual([patch1, patch2]);
  });

  it('separates patches into different repos', () => {
    const patch1 = makePatch({repo_name: 'owner/repo-a'});
    const patch2 = makePatch({repo_name: 'owner/repo-b'});

    const result = collectPatches([patch1, patch2]);

    expect(result.size).toBe(2);
    expect(result.get('owner/repo-a')).toEqual([patch1]);
    expect(result.get('owner/repo-b')).toEqual([patch2]);
  });

  it('deduplicates by file path keeping the last occurrence', () => {
    const patchOld = makePatch({
      repo_name: 'owner/repo',
      diff: 'old diff',
      patch: {
        added: 1,
        removed: 0,
        path: 'file.py',
        source_file: 'file.py',
        target_file: 'file.py',
        type: DiffFileType.MODIFIED,
        hunks: [],
      },
    });
    const patchNew = makePatch({
      repo_name: 'owner/repo',
      diff: 'new diff',
      patch: {
        added: 3,
        removed: 2,
        path: 'file.py',
        source_file: 'file.py',
        target_file: 'file.py',
        type: DiffFileType.MODIFIED,
        hunks: [],
      },
    });

    const result = collectPatches([patchOld, patchNew]);

    expect(result.get('owner/repo')).toHaveLength(1);
    expect(result.get('owner/repo')![0]!.diff).toBe('new diff');
  });

  it('filters out no-op patches with zero added and removed', () => {
    const noOpPatch = makePatch({
      repo_name: 'owner/repo',
      patch: {
        added: 0,
        removed: 0,
        path: 'file.py',
        source_file: 'file.py',
        target_file: 'file.py',
        type: DiffFileType.MODIFIED,
        hunks: [],
      },
    });

    const result = collectPatches([noOpPatch]);

    expect(result.size).toBe(0);
  });

  it('removes repos that have only no-op patches', () => {
    const noOp = makePatch({
      repo_name: 'owner/empty-repo',
      patch: {
        added: 0,
        removed: 0,
        path: 'file.py',
        source_file: 'file.py',
        target_file: 'file.py',
        type: DiffFileType.MODIFIED,
        hunks: [],
      },
    });
    const real = makePatch({repo_name: 'owner/real-repo'});

    const result = collectPatches([noOp, real]);

    expect(result.size).toBe(1);
    expect(result.has('owner/empty-repo')).toBe(false);
    expect(result.get('owner/real-repo')).toEqual([real]);
  });
});

describe('useExplorerAutofix - createPR', () => {
  const GROUP_ID = '123';
  const AUTOFIX_URL = `/organizations/org-slug/issues/${GROUP_ID}/autofix/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: AUTOFIX_URL,
      method: 'GET',
      body: {autofix: null},
    });
  });

  it('sends correct POST request without repoName', async () => {
    const mockPost = MockApiClient.addMockResponse({
      url: AUTOFIX_URL,
      method: 'POST',
      body: {},
    });

    const {result} = renderHookWithProviders(() => useExplorerAutofix(GROUP_ID));

    await act(() => result.current.createPR(42));

    expect(mockPost).toHaveBeenCalledWith(
      AUTOFIX_URL,
      expect.objectContaining({
        method: 'POST',
        query: {mode: 'explorer'},
        data: {step: 'open_pr', run_id: 42},
      })
    );
  });

  it('includes repo_name when repoName is provided', async () => {
    const mockPost = MockApiClient.addMockResponse({
      url: AUTOFIX_URL,
      method: 'POST',
      body: {},
    });

    const {result} = renderHookWithProviders(() => useExplorerAutofix(GROUP_ID));

    await act(() => result.current.createPR(42, 'org/repo'));

    expect(mockPost).toHaveBeenCalledWith(
      AUTOFIX_URL,
      expect.objectContaining({
        method: 'POST',
        query: {mode: 'explorer'},
        data: {step: 'open_pr', run_id: 42, repo_name: 'org/repo'},
      })
    );
  });

  it('calls addErrorMessage and throws on API error', async () => {
    MockApiClient.addMockResponse({
      url: AUTOFIX_URL,
      method: 'POST',
      statusCode: 500,
      body: {detail: 'Server error'},
    });

    const {result} = renderHookWithProviders(() => useExplorerAutofix(GROUP_ID));

    await expect(act(() => result.current.createPR(42))).rejects.toThrow();

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith('Server error');
    });
  });
});
