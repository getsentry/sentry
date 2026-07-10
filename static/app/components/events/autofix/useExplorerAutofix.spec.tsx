import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {DiffFileType, DiffLineType} from 'sentry/components/events/autofix/types';
import {
  collectPatches,
  getOrderedAutofixSections,
  getPollInterval,
  isCodeChangesArtifact,
  isCodingAgentsArtifact,
  isLastStepPrIteration,
  isPrIterationBlock,
  isPullRequestsArtifact,
  isRootCauseArtifact,
  isRunValidForPrIteration,
  isSolutionArtifact,
  useExplorerAutofix,
  type ExplorerAutofixState,
  type RootCauseArtifact,
  type SolutionArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {Artifact, Block, ExplorerFilePatch} from 'sentry/views/seerExplorer/types';

jest.mock('sentry/actionCreators/indicator');

function makeValidArtifact<T>(data: T): Artifact<T> {
  return {
    key: 'artifact-1',
    reason: 'Found a root cause',
    data,
  };
}

describe('getPollInterval', () => {
  function makeState(
    overrides: Partial<ExplorerAutofixState> = {}
  ): ExplorerAutofixState {
    return {
      run_id: 1,
      blocks: [],
      status: 'completed',
      updated_at: '2026-01-01T00:00:00Z',
      ...overrides,
    };
  }

  const completedPr: ExplorerAutofixState['repo_pr_states'] = {
    'org/repo': {pr_creation_status: 'completed'} as any,
  };

  it('polls when pollPR is set and a PR has been created, even when idle', () => {
    const state = makeState({status: 'completed', repo_pr_states: completedPr});
    expect(getPollInterval({autofixState: state, runStarted: false, pollPR: true})).toBe(
      1000
    );
  });

  it('does not poll when pollPR is set but no PR has been created', () => {
    const state = makeState({status: 'completed', repo_pr_states: {}});
    expect(getPollInterval({autofixState: state, runStarted: false, pollPR: true})).toBe(
      false
    );
  });

  it('ignores PR state when pollPR is not set', () => {
    const state = makeState({status: 'completed', repo_pr_states: completedPr});
    expect(getPollInterval({autofixState: state, runStarted: false})).toBe(false);
  });

  it('polls while processing regardless of pollPR', () => {
    const state = makeState({status: 'processing'});
    expect(getPollInterval({autofixState: state, runStarted: false})).toBe(1000);
    expect(getPollInterval({autofixState: state, runStarted: false, pollPR: true})).toBe(
      1000
    );
  });
});

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

describe('getOrderedAutofixSections', () => {
  let blockId = 0;

  function makeBlock(
    overrides: Omit<Partial<Block>, 'message'> & {message?: Partial<Block['message']>}
  ) {
    const {message, ...rest} = overrides;
    return {
      id: `block-${blockId++}`,
      timestamp: '2026-01-01T00:00:00Z',
      message: {
        content: 'hello',
        role: 'assistant',
        ...message,
      },
      ...rest,
    } as Block;
  }

  function makePatch(repoName: string, path: string, diff = 'diff'): ExplorerFilePatch {
    return {
      repo_name: repoName,
      diff,
      patch: {
        added: 1,
        removed: 0,
        path,
        source_file: path,
        target_file: path,
        type: DiffFileType.MODIFIED,
        hunks: [],
      },
    };
  }

  function makeState(blocks: Block[]): ExplorerAutofixState {
    return {
      run_id: 1,
      status: 'completed',
      updated_at: '2026-01-01T00:00:00Z',
      blocks,
    };
  }

  it('returns an empty array for null state or no blocks', () => {
    expect(getOrderedAutofixSections(null)).toEqual([]);
    expect(getOrderedAutofixSections(makeState([]))).toEqual([]);
  });

  it('groups blocks into sections at each step marker', () => {
    const sections = getOrderedAutofixSections(
      makeState([
        makeBlock({message: {metadata: {step: 'root_cause'}}}),
        makeBlock({}),
        makeBlock({message: {metadata: {step: 'solution'}}}),
      ])
    );

    expect(sections.map(s => s.step)).toEqual(['root_cause', 'solution']);
    expect(sections[0]!.blocks).toHaveLength(2);
    expect(sections[1]!.blocks).toHaveLength(1);
  });

  it('merges all code_changes blocks into a single section with the cumulative diff', () => {
    const sections = getOrderedAutofixSections(
      makeState([
        makeBlock({
          message: {metadata: {step: 'code_changes'}},
          merged_file_patches: [makePatch('org/repo', 'a.py', 'first diff')],
        }),
        makeBlock({
          message: {metadata: {step: 'code_changes'}},
          merged_file_patches: [makePatch('org/repo', 'b.py', 'second diff')],
        }),
      ])
    );

    // Consecutive code_changes blocks collapse into one section that carries the
    // cumulative patch set merged across all of its blocks.
    expect(sections).toHaveLength(1);
    expect(sections[0]!.step).toBe('code_changes');
    expect(sections[0]!.artifacts).toEqual([
      [
        makePatch('org/repo', 'a.py', 'first diff'),
        makePatch('org/repo', 'b.py', 'second diff'),
      ],
    ]);
  });

  it('folds consecutive pr_iteration blocks into the single code_changes section', () => {
    const sections = getOrderedAutofixSections(
      makeState([
        makeBlock({
          message: {metadata: {step: 'pr_iteration', iteration_index: '1'}},
          merged_file_patches: [makePatch('org/repo', 'a.py')],
        }),
        makeBlock({
          message: {metadata: {step: 'pr_iteration', iteration_index: '2'}},
          merged_file_patches: [makePatch('org/repo', 'b.py')],
        }),
      ])
    );

    // pr_iteration work is folded into the one code_changes section; both
    // iteration blocks and their merged patches live there.
    expect(sections).toHaveLength(1);
    expect(sections[0]!.step).toBe('code_changes');
    expect(sections[0]!.blocks.map(b => b.message.metadata?.iteration_index)).toEqual([
      '1',
      '2',
    ]);
    expect(sections[0]!.artifacts).toEqual([
      [makePatch('org/repo', 'a.py'), makePatch('org/repo', 'b.py')],
    ]);
  });

  it('merges patches for the same file within a section, last write wins', () => {
    const sections = getOrderedAutofixSections(
      makeState([
        makeBlock({
          message: {metadata: {step: 'code_changes'}},
          merged_file_patches: [makePatch('org/repo', 'a.py', 'old')],
        }),
        makeBlock({
          merged_file_patches: [makePatch('org/repo', 'a.py', 'new')],
        }),
      ])
    );

    expect(sections).toHaveLength(1);
    expect(sections[0]!.artifacts).toEqual([[makePatch('org/repo', 'a.py', 'new')]]);
  });

  it('does not push an empty patch artifact for a code-change section with no patches', () => {
    const sections = getOrderedAutofixSections(
      makeState([makeBlock({message: {metadata: {step: 'pr_iteration'}}})])
    );

    expect(sections).toHaveLength(1);
    expect(sections[0]!.artifacts).toEqual([]);
  });

  it('appends a synthetic pull_request section from repo_pr_states', () => {
    const prState = {
      repo_name: 'org/repo',
      pr_number: 42,
      pr_url: 'https://github.com/org/repo/pull/42',
      branch_name: 'fix/issue',
      commit_sha: 'abc123',
      pr_creation_error: null,
      pr_creation_status: 'completed',
      pr_id: 1,
      title: 'Fix issue',
    } as const;

    const sections = getOrderedAutofixSections({
      ...makeState([makeBlock({message: {metadata: {step: 'code_changes'}}})]),
      repo_pr_states: {'org/repo': prState},
    });

    expect(sections.map(s => s.step)).toEqual(['code_changes', 'pull_request']);
    const prSection = sections[sections.length - 1]!;
    expect(prSection.status).toBe('completed');
    expect(prSection.artifacts).toEqual([[prState]]);
  });

  it('marks the synthetic pull_request section as processing while a PR is creating', () => {
    const sections = getOrderedAutofixSections({
      ...makeState([makeBlock({message: {metadata: {step: 'code_changes'}}})]),
      repo_pr_states: {
        'org/repo': {
          repo_name: 'org/repo',
          pr_creation_status: 'creating',
        } as any,
      },
    });

    expect(sections[sections.length - 1]!.status).toBe('processing');
  });
});

describe('isPrIterationBlock', () => {
  function block(metadata?: Record<string, string>): Block {
    return {
      id: 'block-1',
      timestamp: '2026-01-01T00:00:00Z',
      message: {content: 'hello', role: 'assistant', metadata},
    } as Block;
  }

  it('is true only for blocks whose step is pr_iteration', () => {
    expect(isPrIterationBlock(block({step: 'pr_iteration'}))).toBe(true);
    expect(isPrIterationBlock(block({step: 'code_changes'}))).toBe(false);
    expect(isPrIterationBlock(block())).toBe(false);
  });
});

describe('isRunValidForPrIteration', () => {
  it('is true only when the autofix-pr-iteration feature is enabled', () => {
    expect(
      isRunValidForPrIteration(OrganizationFixture({features: ['autofix-pr-iteration']}))
    ).toBe(true);
    expect(isRunValidForPrIteration(OrganizationFixture({features: []}))).toBe(false);
  });
});

describe('isLastStepPrIteration', () => {
  let blockId = 0;
  function block(step?: string): Block {
    return {
      id: `block-${blockId++}`,
      timestamp: '2026-01-01T00:00:00Z',
      message: {
        content: 'hello',
        role: 'assistant',
        metadata: step ? {step} : undefined,
      },
    } as Block;
  }
  function state(blocks: Block[]): ExplorerAutofixState {
    return {
      run_id: 1,
      status: 'completed',
      updated_at: '2026-01-01T00:00:00Z',
      blocks,
    };
  }

  it('is true when the last block carrying a step is pr_iteration', () => {
    expect(
      isLastStepPrIteration(state([block('code_changes'), block('pr_iteration')]))
    ).toBe(true);
  });

  it('ignores trailing step-less blocks when finding the last step', () => {
    expect(
      isLastStepPrIteration(
        state([block('pr_iteration'), block(undefined), block(undefined)])
      )
    ).toBe(true);
  });

  it('is false when the last step is not pr_iteration', () => {
    expect(
      isLastStepPrIteration(state([block('pr_iteration'), block('code_changes')]))
    ).toBe(false);
  });

  it('is false when there are no blocks with a step or no run state', () => {
    expect(isLastStepPrIteration(state([block(undefined)]))).toBe(false);
    expect(isLastStepPrIteration(null)).toBe(false);
  });
});

const GROUP_ID = '123';
const MOCK_GROUP = GroupFixture({id: GROUP_ID});

describe('useExplorerAutofix - createPR', () => {
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

    const {result} = renderHookWithProviders(() => useExplorerAutofix(MOCK_GROUP));

    await act(() => result.current.createPR(42));

    expect(mockPost).toHaveBeenCalledWith(
      AUTOFIX_URL,
      expect.objectContaining({
        method: 'POST',
        query: {mode: 'explorer'},
        data: {step: 'open_pr', run_id: 42, referrer: 'api.web'},
      })
    );
  });

  it('includes repo_name when repoName is provided', async () => {
    const mockPost = MockApiClient.addMockResponse({
      url: AUTOFIX_URL,
      method: 'POST',
      body: {},
    });

    const {result} = renderHookWithProviders(() => useExplorerAutofix(MOCK_GROUP));

    await act(() => result.current.createPR(42, 'org/repo'));

    expect(mockPost).toHaveBeenCalledWith(
      AUTOFIX_URL,
      expect.objectContaining({
        method: 'POST',
        query: {mode: 'explorer'},
        data: {step: 'open_pr', run_id: 42, repo_name: 'org/repo', referrer: 'api.web'},
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

    const {result} = renderHookWithProviders(() => useExplorerAutofix(MOCK_GROUP));

    await expect(act(() => result.current.createPR(42))).rejects.toThrow();

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith('Server error');
    });
  });
});

describe('useExplorerAutofix - startStep pr_iteration', () => {
  const AUTOFIX_URL = `/organizations/org-slug/issues/${GROUP_ID}/autofix/`;
  const baseState = {
    run_id: 42,
    blocks: [],
    status: 'processing' as const,
    updated_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: AUTOFIX_URL,
      method: 'GET',
      body: {autofix: baseState},
    });
  });

  it('sends the POST with user_context', async () => {
    const mockPost = MockApiClient.addMockResponse({
      url: AUTOFIX_URL,
      method: 'POST',
      body: {run_id: 42},
    });

    const {result} = renderHookWithProviders(() => useExplorerAutofix(MOCK_GROUP));

    await act(() =>
      result.current.startStep('pr_iteration', {runId: 42, userContext: 'make it blue'})
    );

    expect(mockPost).toHaveBeenCalledWith(
      AUTOFIX_URL,
      expect.objectContaining({
        method: 'POST',
        query: {mode: 'explorer'},
        data: {
          step: 'pr_iteration',
          run_id: 42,
          user_context: 'make it blue',
          referrer: 'api.web',
        },
      })
    );
  });

  it('awaits the refetch so queued feedback is present once it resolves', async () => {
    MockApiClient.addMockResponse({
      url: AUTOFIX_URL,
      method: 'POST',
      body: {run_id: 42},
    });

    const {result} = renderHookWithProviders(() => useExplorerAutofix(MOCK_GROUP));

    await waitFor(() => expect(result.current.runState?.run_id).toBe(42));
    expect(result.current.runState?.queued_feedback).toBeUndefined();

    MockApiClient.addMockResponse({
      url: AUTOFIX_URL,
      method: 'GET',
      body: {
        autofix: {
          ...baseState,
          queued_feedback: [{text: 'make it blue', source: {type: 'user-ui'}}],
        },
      },
    });

    await act(() =>
      result.current.startStep('pr_iteration', {runId: 42, userContext: 'make it blue'})
    );

    expect(result.current.runState?.queued_feedback).toHaveLength(1);
  });
});

describe('useExplorerAutofix - codingAgentErrors', () => {
  const AUTOFIX_URL = `/organizations/org-slug/issues/${GROUP_ID}/autofix/`;
  const integration = {id: '42', name: 'Claude Agent', provider: 'claude_code' as const};

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: AUTOFIX_URL,
      method: 'GET',
      body: {autofix: null},
    });
  });

  it('accumulates generic failures across multiple launch attempts', async () => {
    MockApiClient.addMockResponse({
      url: AUTOFIX_URL,
      method: 'POST',
      body: {
        successes: [],
        failures: [{error_message: 'first error', repo_name: 'org/repo'}],
      },
    });

    const {result} = renderHookWithProviders(() => useExplorerAutofix(MOCK_GROUP));

    await act(() => result.current.triggerCodingAgentHandoff(1, integration));
    await waitFor(() => {
      expect(result.current.codingAgentErrors.map(e => e.message)).toEqual([
        'first error',
      ]);
    });

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: AUTOFIX_URL,
      method: 'GET',
      body: {autofix: null},
    });
    MockApiClient.addMockResponse({
      url: AUTOFIX_URL,
      method: 'POST',
      body: {
        successes: [],
        failures: [{error_message: 'second error', repo_name: 'org/repo'}],
      },
    });

    await act(() => result.current.triggerCodingAgentHandoff(1, integration));
    await waitFor(() => {
      expect(result.current.codingAgentErrors.map(e => e.message)).toEqual([
        'first error',
        'second error',
      ]);
    });
  });

  it('appends API-level errors (rejected request) to the list', async () => {
    MockApiClient.addMockResponse({
      url: AUTOFIX_URL,
      method: 'POST',
      statusCode: 500,
      body: {detail: 'boom'},
    });

    const {result} = renderHookWithProviders(() => useExplorerAutofix(MOCK_GROUP));

    await expect(
      act(() => result.current.triggerCodingAgentHandoff(1, integration))
    ).rejects.toBeDefined();

    await waitFor(() => {
      expect(result.current.codingAgentErrors.map(e => e.message)).toEqual(['boom']);
    });
  });

  it('dismissCodingAgentError removes the error with the given id', async () => {
    MockApiClient.addMockResponse({
      url: AUTOFIX_URL,
      method: 'POST',
      body: {
        successes: [],
        failures: [
          {error_message: 'a', repo_name: 'org/repo'},
          {error_message: 'b', repo_name: 'org/repo'},
          {error_message: 'c', repo_name: 'org/repo'},
        ],
      },
    });

    const {result} = renderHookWithProviders(() => useExplorerAutofix(MOCK_GROUP));

    await act(() => result.current.triggerCodingAgentHandoff(1, integration));
    await waitFor(() => {
      expect(result.current.codingAgentErrors.map(e => e.message)).toEqual([
        'a',
        'b',
        'c',
      ]);
    });

    const bId = result.current.codingAgentErrors[1]!.id;
    act(() => result.current.dismissCodingAgentError(bId));
    expect(result.current.codingAgentErrors.map(e => e.message)).toEqual(['a', 'c']);
  });
});
