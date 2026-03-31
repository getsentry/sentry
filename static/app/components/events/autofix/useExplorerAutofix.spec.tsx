import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {DiffFileType, DiffLineType} from 'sentry/components/events/autofix/types';
import {
  isCodeChangesArtifact,
  isCodingAgentsArtifact,
  isPullRequestsArtifact,
  isRootCauseArtifact,
  isSolutionArtifact,
  useExplorerAutofix,
  type RootCauseArtifact,
  type SolutionArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {Artifact} from 'sentry/views/seerExplorer/types';

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
