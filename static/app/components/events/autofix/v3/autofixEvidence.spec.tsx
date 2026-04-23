import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, renderHookWithProviders, screen} from 'sentry-test/reactTestingLibrary';

import type {AutofixSection} from 'sentry/components/events/autofix/useExplorerAutofix';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Block, ToolCall, ToolLink} from 'sentry/views/seerExplorer/types';

import {AutofixEvidence} from './autofixEvidence';
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

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
  });

  describe('null rendering', () => {
    it('renders nothing when toolLink is missing', () => {
      const {container} = render(
        <AutofixEvidence toolCall={makeToolCall('telemetry_live_search')} />,
        {organization}
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when toolLink kind is unknown', () => {
      const {container} = render(
        <AutofixEvidence
          toolCall={makeToolCall('telemetry_live_search')}
          toolLink={makeToolLink('unknown_kind')}
        />,
        {organization}
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing for unknown toolCall function with valid toolLink', () => {
      const {container} = render(
        <AutofixEvidence
          toolCall={makeToolCall('unknown_function')}
          toolLink={makeToolLink('telemetry_live_search', {query: 'test'})}
        />,
        {organization}
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('EvidenceTelemetry', () => {
    it('renders "Query: Spans" for spans dataset', () => {
      render(
        <AutofixEvidence
          toolCall={makeToolCall('telemetry_live_search')}
          toolLink={makeToolLink('telemetry_live_search', {
            dataset: 'spans',
            query: 'test',
          })}
        />,
        {organization}
      );
      expect(screen.getByText('Query: Spans')).toBeInTheDocument();
    });

    it('renders "Query: Issues" for issues dataset', () => {
      render(
        <AutofixEvidence
          toolCall={makeToolCall('telemetry_live_search')}
          toolLink={makeToolLink('telemetry_live_search', {
            dataset: 'issues',
            query: 'test',
          })}
        />,
        {organization}
      );
      expect(screen.getByText('Query: Issues')).toBeInTheDocument();
    });

    it('renders "Query: Errors" for errors dataset', () => {
      render(
        <AutofixEvidence
          toolCall={makeToolCall('telemetry_live_search')}
          toolLink={makeToolLink('telemetry_live_search', {
            dataset: 'errors',
            query: 'test',
          })}
        />,
        {organization}
      );
      expect(screen.getByText('Query: Errors')).toBeInTheDocument();
    });

    it('renders "Query: Logs" for logs dataset', () => {
      render(
        <AutofixEvidence
          toolCall={makeToolCall('telemetry_live_search')}
          toolLink={makeToolLink('telemetry_live_search', {
            dataset: 'logs',
            query: 'test',
          })}
        />,
        {organization}
      );
      expect(screen.getByText('Query: Logs')).toBeInTheDocument();
    });

    it('renders "Query: Metrics" for metrics dataset', () => {
      render(
        <AutofixEvidence
          toolCall={makeToolCall('telemetry_live_search')}
          toolLink={makeToolLink('telemetry_live_search', {
            dataset: 'metrics',
            query: 'test',
          })}
        />,
        {organization}
      );
      expect(screen.getByText('Query: Metrics')).toBeInTheDocument();
    });

    it('renders "Query: Metrics" for tracemetrics dataset', () => {
      render(
        <AutofixEvidence
          toolCall={makeToolCall('telemetry_live_search')}
          toolLink={makeToolLink('telemetry_live_search', {
            dataset: 'tracemetrics',
            query: 'test',
          })}
        />,
        {organization}
      );
      expect(screen.getByText('Query: Metrics')).toBeInTheDocument();
    });

    it('defaults to "Query: Spans" when dataset is undefined', () => {
      render(
        <AutofixEvidence
          toolCall={makeToolCall('telemetry_live_search')}
          toolLink={makeToolLink('telemetry_live_search', {query: 'test'})}
        />,
        {organization}
      );
      expect(screen.getByText('Query: Spans')).toBeInTheDocument();
    });
  });

  describe('EvidenceTrace', () => {
    it('renders span label when span_id is provided', () => {
      render(
        <AutofixEvidence
          toolCall={makeToolCall('get_trace_waterfall')}
          toolLink={makeToolLink('get_trace_waterfall', {
            trace_id: 'abc123def4567890',
            span_id: '11223344aabbccdd',
          })}
        />,
        {organization}
      );
      expect(screen.getByText('Span: 11223344')).toBeInTheDocument();
    });

    it('renders trace label when only trace_id is provided', () => {
      render(
        <AutofixEvidence
          toolCall={makeToolCall('get_trace_waterfall')}
          toolLink={makeToolLink('get_trace_waterfall', {
            trace_id: 'abc123def4567890',
          })}
        />,
        {organization}
      );
      expect(screen.getByText('Trace: abc123de')).toBeInTheDocument();
    });
  });

  describe('EvidenceIssue', () => {
    it('renders error label with event_id via get_event_details', () => {
      render(
        <AutofixEvidence
          toolCall={makeToolCall('get_event_details')}
          toolLink={makeToolLink('get_event_details', {
            event_id: 'abcd1234efgh5678',
            issue_id: '12345',
          })}
        />,
        {organization}
      );
      expect(screen.getByText('Error: abcd1234')).toBeInTheDocument();
    });

    it('renders error label with event_id via get_issue_details', () => {
      render(
        <AutofixEvidence
          toolCall={makeToolCall('get_issue_details')}
          toolLink={makeToolLink('get_issue_details', {
            issue_id: '12345',
            event_id: 'abcd1234efgh5678',
          })}
        />,
        {organization}
      );
      expect(screen.getByText('Error: abcd1234')).toBeInTheDocument();
    });

    it('renders nothing when event_id is missing for get_issue_details', () => {
      const {container} = render(
        <AutofixEvidence
          toolCall={makeToolCall('get_issue_details')}
          toolLink={makeToolLink('get_issue_details', {issue_id: '12345'})}
        />,
        {organization}
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('EvidenceReplay', () => {
    it('renders replay label', () => {
      render(
        <AutofixEvidence
          toolCall={makeToolCall('get_replay_details')}
          toolLink={makeToolLink('get_replay_details', {
            replay_id: 'aabbccdd11223344',
          })}
        />,
        {organization}
      );
      expect(screen.getByText('Replay: aabbccdd')).toBeInTheDocument();
    });
  });

  describe('EvidenceProfile', () => {
    it('renders profile label', () => {
      render(
        <AutofixEvidence
          toolCall={makeToolCall('get_profile_flamegraph')}
          toolLink={makeToolLink('get_profile_flamegraph', {
            profile_id: 'prof1234abcd5678',
            project_id: '1',
          })}
        />,
        {organization}
      );
      expect(screen.getByText('Profile: prof1234')).toBeInTheDocument();
    });
  });

  describe('EvidenceCodeSearch', () => {
    it('renders filename for read_file mode', () => {
      render(
        <AutofixEvidence
          toolCall={makeToolCall('code_search', {
            mode: 'read_file',
            path: 'src/foo/bar.py',
          })}
          toolLink={makeToolLink('code_search', {
            code_url: 'https://github.com/org/repo/blob/main/src/foo/bar.py',
          })}
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
      render(
        <AutofixEvidence
          toolCall={makeToolCall('code_search', {
            mode: 'read_file',
            path: 'src/foo/thisisalongfilename.py',
          })}
          toolLink={makeToolLink('code_search', {
            code_url:
              'https://github.com/org/repo/blob/main/src/foo/thisisalongfilename.py',
          })}
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

    it('renders nothing when mode is not read_file', () => {
      const {container} = render(
        <AutofixEvidence
          toolCall={makeToolCall('code_search', {mode: 'search', query: 'foo'})}
          toolLink={makeToolLink('code_search', {
            code_url: 'https://github.com/org/repo',
          })}
        />,
        {organization}
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when mode is missing', () => {
      const {container} = render(
        <AutofixEvidence
          toolCall={makeToolCall('code_search', {path: 'src/foo/bar.py'})}
          toolLink={makeToolLink('code_search', {
            code_url: 'https://github.com/org/repo/blob/main/src/foo/bar.py',
          })}
        />,
        {organization}
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when toolLink is missing', () => {
      const {container} = render(
        <AutofixEvidence
          toolCall={makeToolCall('code_search', {
            mode: 'read_file',
            path: 'src/foo/bar.py',
          })}
        />,
        {organization}
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when code_url is missing from toolLink params', () => {
      const {container} = render(
        <AutofixEvidence
          toolCall={makeToolCall('code_search', {
            mode: 'read_file',
            path: 'src/foo/bar.py',
          })}
          toolLink={makeToolLink('code_search', {})}
        />,
        {organization}
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when path is missing from args', () => {
      const {container} = render(
        <AutofixEvidence
          toolCall={makeToolCall('code_search', {mode: 'read_file'})}
          toolLink={makeToolLink('code_search', {
            code_url: 'https://github.com/org/repo/blob/main/src/foo/bar.py',
          })}
        />,
        {organization}
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when args is invalid JSON', () => {
      const {container} = render(
        <AutofixEvidence
          toolCall={{id: 'tc-1', function: 'code_search', args: '{invalid json'}}
          toolLink={makeToolLink('code_search', {
            code_url: 'https://github.com/org/repo/blob/main/src/foo/bar.py',
          })}
        />,
        {organization}
      );
      expect(container).toBeEmptyDOMElement();
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

  it('sets toolLink to undefined when tool_links array is missing', () => {
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

    expect(result.current).toHaveLength(1);
    expect(result.current[0]!.toolLink).toBeUndefined();
  });
});
