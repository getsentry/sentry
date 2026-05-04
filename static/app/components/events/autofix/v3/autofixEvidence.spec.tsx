import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, renderHookWithProviders, screen} from 'sentry-test/reactTestingLibrary';

import type {AutofixSection} from 'sentry/components/events/autofix/useExplorerAutofix';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Block, ToolCall, ToolLink} from 'sentry/views/seerExplorer/types';

import {
  AutofixEvidence,
  AUTOFIX_EVIDENCE_PROPS_RESOLVER,
  type EvidenceButtonProps,
} from './autofixEvidence';
import {useAutofixSectionEvidence} from './useAutofixSectionEvidence';

function makeToolCall(fn: string, args: Record<string, any> = {}, id = 'tc-1'): ToolCall {
  return {id, function: fn, args: JSON.stringify(args)};
}

function makeToolLink(kind: string, params: Record<string, any> = {}): ToolLink {
  return {kind, params};
}

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: 'block-1',
    timestamp: '2024-01-01T00:00:00Z',
    message: {content: '', role: 'assistant'},
    ...overrides,
  };
}

function makeSection(blocks: Block[]): AutofixSection {
  return {step: 'exploration', status: 'completed', artifacts: [], blocks};
}

describe('AutofixEvidence', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({id: '1', slug: 'test-project'});

  function resolveProps(
    toolCall: ToolCall,
    toolLink?: ToolLink
  ): EvidenceButtonProps | null {
    const resolver = AUTOFIX_EVIDENCE_PROPS_RESOLVER[toolCall.function];
    return resolver?.({organization, projects: [project], toolCall, toolLink}) ?? null;
  }

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
  });

  describe('null rendering', () => {
    it('returns null when toolLink is missing', () => {
      expect(resolveProps(makeToolCall('telemetry_live_search'))).toBeNull();
    });

    it('returns null when toolLink kind is unknown', () => {
      expect(
        resolveProps(makeToolCall('telemetry_live_search'), makeToolLink('unknown_kind'))
      ).toBeNull();
    });

    it('returns null for unknown toolCall function with valid toolLink', () => {
      expect(
        resolveProps(
          makeToolCall('unknown_function'),
          makeToolLink('telemetry_live_search', {query: 'test'})
        )
      ).toBeNull();
    });
  });

  describe('EvidenceTelemetry', () => {
    it('renders "Query: Spans" for spans dataset', () => {
      const toolCall = makeToolCall('telemetry_live_search');
      const toolLink = makeToolLink('telemetry_live_search', {
        dataset: 'spans',
        query: 'test',
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Query: Spans')).toBeInTheDocument();
    });

    it('renders "Query: Issues" for issues dataset', () => {
      const toolCall = makeToolCall('telemetry_live_search');
      const toolLink = makeToolLink('telemetry_live_search', {
        dataset: 'issues',
        query: 'test',
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Query: Issues')).toBeInTheDocument();
    });

    it('renders "Query: Errors" for errors dataset', () => {
      const toolCall = makeToolCall('telemetry_live_search');
      const toolLink = makeToolLink('telemetry_live_search', {
        dataset: 'errors',
        query: 'test',
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Query: Errors')).toBeInTheDocument();
    });

    it('renders "Query: Logs" for logs dataset', () => {
      const toolCall = makeToolCall('telemetry_live_search');
      const toolLink = makeToolLink('telemetry_live_search', {
        dataset: 'logs',
        query: 'test',
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Query: Logs')).toBeInTheDocument();
    });

    it('renders "Query: Metrics" for metrics dataset', () => {
      const toolCall = makeToolCall('telemetry_live_search');
      const toolLink = makeToolLink('telemetry_live_search', {
        dataset: 'metrics',
        query: 'test',
        trace_metric: {name: 'tool.duration', type: 'distribution', unit: 'second'},
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Query: Metrics')).toBeInTheDocument();
    });

    it('renders "Query: Metrics" for tracemetrics dataset', () => {
      const toolCall = makeToolCall('telemetry_live_search');
      const toolLink = makeToolLink('telemetry_live_search', {
        dataset: 'tracemetrics',
        query: 'test',
        trace_metric: {name: 'tool.duration', type: 'distribution', unit: 'second'},
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Query: Metrics')).toBeInTheDocument();
    });

    it('defaults to "Query: Spans" when dataset is undefined', () => {
      const toolCall = makeToolCall('telemetry_live_search');
      const toolLink = makeToolLink('telemetry_live_search', {query: 'test'});
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Query: Spans')).toBeInTheDocument();
    });
  });

  describe('EvidenceTrace', () => {
    it('renders span label when span_id is provided', () => {
      const toolCall = makeToolCall('get_trace_waterfall');
      const toolLink = makeToolLink('get_trace_waterfall', {
        trace_id: 'abc123def4567890',
        span_id: '11223344aabbccdd',
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Span: 11223344')).toBeInTheDocument();
    });

    it('renders trace label when only trace_id is provided', () => {
      const toolCall = makeToolCall('get_trace_waterfall');
      const toolLink = makeToolLink('get_trace_waterfall', {
        trace_id: 'abc123def4567890',
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Trace: abc123de')).toBeInTheDocument();
    });
  });

  describe('EvidenceIssue', () => {
    it('renders error label with event_id via get_event_details', () => {
      const toolCall = makeToolCall('get_event_details');
      const toolLink = makeToolLink('get_event_details', {
        event_id: 'abcd1234efgh5678',
        issue_id: '12345',
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Error: abcd1234')).toBeInTheDocument();
    });

    it('renders error label with event_id via get_issue_details', () => {
      const toolCall = makeToolCall('get_issue_details');
      const toolLink = makeToolLink('get_issue_details', {
        issue_id: '12345',
        event_id: 'abcd1234efgh5678',
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Error: abcd1234')).toBeInTheDocument();
    });

    it('returns null when event_id is missing for get_issue_details', () => {
      expect(
        resolveProps(
          makeToolCall('get_issue_details'),
          makeToolLink('get_issue_details', {issue_id: '12345'})
        )
      ).toBeNull();
    });
  });

  describe('EvidenceReplay', () => {
    it('renders replay label', () => {
      const toolCall = makeToolCall('get_replay_details');
      const toolLink = makeToolLink('get_replay_details', {
        replay_id: 'aabbccdd11223344',
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Replay: aabbccdd')).toBeInTheDocument();
    });
  });

  describe('EvidenceProfile', () => {
    it('renders profile label', () => {
      const toolCall = makeToolCall('get_profile_flamegraph');
      const toolLink = makeToolLink('get_profile_flamegraph', {
        profile_id: 'prof1234abcd5678',
        project_id: '1',
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Profile: prof1234')).toBeInTheDocument();
    });
  });

  describe('EvidenceCodeSearch', () => {
    it('renders filename for read_file mode', () => {
      const toolCall = makeToolCall('code_search', {
        mode: 'read_file',
        path: 'src/foo/bar.py',
      });
      const toolLink = makeToolLink('code_search', {
        code_url: 'https://github.com/org/repo/blob/main/src/foo/bar.py',
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('File: bar.py')).toBeInTheDocument();
      expect(screen.getByText('File: bar.py').closest('a')).toHaveAttribute(
        'href',
        'https://github.com/org/repo/blob/main/src/foo/bar.py'
      );
    });

    it('renders truncated filename for read_file mode', () => {
      const toolCall = makeToolCall('code_search', {
        mode: 'read_file',
        path: 'src/foo/thisisalongfilename.py',
      });
      const toolLink = makeToolLink('code_search', {
        code_url: 'https://github.com/org/repo/blob/main/src/foo/thisisalongfilename.py',
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('File: thisisal\u2026ename.py')).toBeInTheDocument();
      expect(
        screen.getByText('File: thisisal\u2026ename.py').closest('a')
      ).toHaveAttribute(
        'href',
        'https://github.com/org/repo/blob/main/src/foo/thisisalongfilename.py'
      );
    });

    it('returns null when mode is not read_file', () => {
      expect(
        resolveProps(
          makeToolCall('code_search', {mode: 'search', query: 'foo'}),
          makeToolLink('code_search', {code_url: 'https://github.com/org/repo'})
        )
      ).toBeNull();
    });

    it('returns null when mode is missing', () => {
      expect(
        resolveProps(
          makeToolCall('code_search', {path: 'src/foo/bar.py'}),
          makeToolLink('code_search', {
            code_url: 'https://github.com/org/repo/blob/main/src/foo/bar.py',
          })
        )
      ).toBeNull();
    });

    it('returns null when toolLink is missing', () => {
      expect(
        resolveProps(
          makeToolCall('code_search', {mode: 'read_file', path: 'src/foo/bar.py'})
        )
      ).toBeNull();
    });

    it('returns null when code_url is missing from toolLink params', () => {
      expect(
        resolveProps(
          makeToolCall('code_search', {mode: 'read_file', path: 'src/foo/bar.py'}),
          makeToolLink('code_search', {})
        )
      ).toBeNull();
    });

    it('returns null when path is missing from args', () => {
      expect(
        resolveProps(
          makeToolCall('code_search', {mode: 'read_file'}),
          makeToolLink('code_search', {
            code_url: 'https://github.com/org/repo/blob/main/src/foo/bar.py',
          })
        )
      ).toBeNull();
    });

    it('returns null when args is invalid JSON', () => {
      expect(
        resolveProps(
          {id: 'tc-1', function: 'code_search', args: '{invalid json'},
          makeToolLink('code_search', {
            code_url: 'https://github.com/org/repo/blob/main/src/foo/bar.py',
          })
        )
      ).toBeNull();
    });
  });

  describe('EvidenceGitSearch', () => {
    const FULL_SHA = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    const COMMIT_URL = 'https://github.com/org/repo/commit/a1b2c3d';
    const COMMITS_URL =
      'https://github.com/org/repo/commits?since=2024-01-01&until=2024-01-31';
    const REPO_NAME = 'org/repo';
    const START_DATE = '2024-01-01';
    const END_DATE = '2024-01-31';

    it('renders commit label with short hash for single commit', () => {
      const toolCall = makeToolCall('git_search');
      const toolLink = makeToolLink('git_search', {
        commit_url: COMMIT_URL,
        sha: FULL_SHA,
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Commit: a1b2c3d')).toBeInTheDocument();
      expect(screen.getByText('Commit: a1b2c3d').closest('a')).toHaveAttribute(
        'href',
        COMMIT_URL
      );
    });

    it('renders full sha when sha is not a 40-char hex hash', () => {
      const shortSha = 'abc1234';
      const toolCall = makeToolCall('git_search');
      const toolLink = makeToolLink('git_search', {
        commit_url: COMMIT_URL,
        sha: shortSha,
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Commit: abc1234')).toBeInTheDocument();
    });

    it('renders commits label with repo name when file_path is absent', () => {
      const toolCall = makeToolCall('git_search');
      const toolLink = makeToolLink('git_search', {
        commits_url: COMMITS_URL,
        repo_name: REPO_NAME,
        start_date: START_DATE,
        end_date: END_DATE,
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText(`Commits: ${REPO_NAME}`)).toBeInTheDocument();
      expect(screen.getByText(`Commits: ${REPO_NAME}`).closest('a')).toHaveAttribute(
        'href',
        COMMITS_URL
      );
    });

    it('renders commits label with short file_path without truncation', () => {
      const toolCall = makeToolCall('git_search');
      const toolLink = makeToolLink('git_search', {
        commits_url: COMMITS_URL,
        repo_name: REPO_NAME,
        start_date: START_DATE,
        end_date: END_DATE,
        file_path: 'src/foo/bar.py',
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Commits: bar.py')).toBeInTheDocument();
    });

    it('renders commits label with truncated file_path when file_path is long', () => {
      const toolCall = makeToolCall('git_search');
      const toolLink = makeToolLink('git_search', {
        commits_url: COMMITS_URL,
        repo_name: REPO_NAME,
        start_date: START_DATE,
        end_date: END_DATE,
        file_path: 'src/components/thisisalongfilename.tsx',
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Commits: thisisal\u2026name.tsx')).toBeInTheDocument();
    });

    it('prefers single commit path when both param sets are present', () => {
      const toolCall = makeToolCall('git_search');
      const toolLink = makeToolLink('git_search', {
        commit_url: COMMIT_URL,
        sha: FULL_SHA,
        commits_url: COMMITS_URL,
        repo_name: REPO_NAME,
        start_date: START_DATE,
        end_date: END_DATE,
      });
      const props = resolveProps(toolCall, toolLink);
      render(
        <AutofixEvidence
          evidenceButtonProps={props!}
          groupId="123"
          toolCall={toolCall}
        />,
        {organization}
      );
      expect(screen.getByText('Commit: a1b2c3d')).toBeInTheDocument();
    });

    it('returns null when toolLink is missing', () => {
      expect(resolveProps(makeToolCall('git_search'))).toBeNull();
    });

    it('returns null when toolLink params are empty', () => {
      expect(
        resolveProps(makeToolCall('git_search'), makeToolLink('git_search', {}))
      ).toBeNull();
    });

    it('returns null when commit_url is present but sha is missing', () => {
      expect(
        resolveProps(
          makeToolCall('git_search'),
          makeToolLink('git_search', {commit_url: COMMIT_URL})
        )
      ).toBeNull();
    });

    it('returns null when sha is present but commit_url is missing', () => {
      expect(
        resolveProps(
          makeToolCall('git_search'),
          makeToolLink('git_search', {sha: FULL_SHA})
        )
      ).toBeNull();
    });

    it('returns null when commits_url path is missing end_date', () => {
      expect(
        resolveProps(
          makeToolCall('git_search'),
          makeToolLink('git_search', {
            commits_url: COMMITS_URL,
            repo_name: REPO_NAME,
            start_date: START_DATE,
          })
        )
      ).toBeNull();
    });

    it('returns null when commits_url path is missing repo_name', () => {
      expect(
        resolveProps(
          makeToolCall('git_search'),
          makeToolLink('git_search', {
            commits_url: COMMITS_URL,
            start_date: START_DATE,
            end_date: END_DATE,
          })
        )
      ).toBeNull();
    });

    it('returns null when commit_url is not a string', () => {
      expect(
        resolveProps(
          makeToolCall('git_search'),
          makeToolLink('git_search', {commit_url: 123, sha: FULL_SHA})
        )
      ).toBeNull();
    });
  });
});

describe('useAutofixSectionEvidence', () => {
  it('extracts evidence from blocks with matching tool results', () => {
    const section = makeSection([
      makeBlock({
        message: {
          content: '',
          role: 'assistant',
          tool_calls: [makeToolCall('telemetry_live_search', {}, 'tc-1')],
        },
        tool_results: [
          {
            tool_call_id: 'tc-1',
            tool_call_function: 'telemetry_live_search',
            content: 'results',
          },
        ],
        tool_links: [makeToolLink('telemetry_live_search', {dataset: 'spans'})],
      }),
    ]);

    const {result} = renderHookWithProviders(() => useAutofixSectionEvidence({section}));

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.toolCall.id).toBe('tc-1');
    expect(result.current[0]!.toolLink?.kind).toBe('telemetry_live_search');
    expect(result.current[0]!.toolResult?.tool_call_id).toBe('tc-1');
  });

  it('extracts multiple evidence items from a single block', () => {
    const section = makeSection([
      makeBlock({
        message: {
          content: '',
          role: 'assistant',
          tool_calls: [
            makeToolCall('telemetry_live_search', {}, 'tc-1'),
            makeToolCall('get_trace_waterfall', {}, 'tc-2'),
          ],
        },
        tool_results: [
          {
            tool_call_id: 'tc-1',
            tool_call_function: 'telemetry_live_search',
            content: 'r1',
          },
          {
            tool_call_id: 'tc-2',
            tool_call_function: 'get_trace_waterfall',
            content: 'r2',
          },
        ],
        tool_links: [
          makeToolLink('telemetry_live_search', {dataset: 'spans'}),
          makeToolLink('get_trace_waterfall', {trace_id: 'abc'}),
        ],
      }),
    ]);

    const {result} = renderHookWithProviders(() => useAutofixSectionEvidence({section}));

    expect(result.current).toHaveLength(2);
    expect(result.current[0]!.toolCall.id).toBe('tc-1');
    expect(result.current[1]!.toolCall.id).toBe('tc-2');
  });

  it('flattens evidence across multiple blocks', () => {
    const section = makeSection([
      makeBlock({
        id: 'b1',
        message: {
          content: '',
          role: 'assistant',
          tool_calls: [makeToolCall('telemetry_live_search', {}, 'tc-1')],
        },
        tool_results: [
          {
            tool_call_id: 'tc-1',
            tool_call_function: 'telemetry_live_search',
            content: 'r1',
          },
        ],
        tool_links: [makeToolLink('telemetry_live_search', {dataset: 'spans'})],
      }),
      makeBlock({
        id: 'b2',
        message: {
          content: '',
          role: 'assistant',
          tool_calls: [makeToolCall('get_trace_waterfall', {}, 'tc-2')],
        },
        tool_results: [
          {
            tool_call_id: 'tc-2',
            tool_call_function: 'get_trace_waterfall',
            content: 'r2',
          },
        ],
        tool_links: [makeToolLink('get_trace_waterfall', {trace_id: 'abc'})],
      }),
    ]);

    const {result} = renderHookWithProviders(() => useAutofixSectionEvidence({section}));

    expect(result.current).toHaveLength(2);
  });

  it('returns empty array for empty blocks', () => {
    const section = makeSection([]);

    const {result} = renderHookWithProviders(() => useAutofixSectionEvidence({section}));

    expect(result.current).toEqual([]);
  });

  it('returns empty array when blocks have no tool_calls', () => {
    const section = makeSection([makeBlock({message: {content: '', role: 'assistant'}})]);

    const {result} = renderHookWithProviders(() => useAutofixSectionEvidence({section}));

    expect(result.current).toEqual([]);
  });

  it('returns empty array when tool_results is undefined', () => {
    const section = makeSection([
      makeBlock({
        message: {
          content: '',
          role: 'assistant',
          tool_calls: [makeToolCall('telemetry_live_search', {}, 'tc-1')],
        },
      }),
    ]);

    const {result} = renderHookWithProviders(() => useAutofixSectionEvidence({section}));

    expect(result.current).toEqual([]);
  });

  it('filters out evidence when tool_links array is missing', () => {
    const section = makeSection([
      makeBlock({
        message: {
          content: '',
          role: 'assistant',
          tool_calls: [makeToolCall('telemetry_live_search', {}, 'tc-1')],
        },
        tool_results: [
          {
            tool_call_id: 'tc-1',
            tool_call_function: 'telemetry_live_search',
            content: 'r1',
          },
        ],
      }),
    ]);

    const {result} = renderHookWithProviders(() => useAutofixSectionEvidence({section}));

    expect(result.current).toEqual([]);
  });
});
