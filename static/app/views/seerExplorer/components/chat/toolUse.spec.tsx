import {render, screen} from 'sentry-test/reactTestingLibrary';

import {BlockComponent} from 'sentry/views/seerExplorer/components/chat';
import type {Block} from 'sentry/views/seerExplorer/types';

function createBlock(overrides?: Partial<Block>): Block {
  return {
    id: 'tool-1',
    message: {
      role: 'tool_use',
      content: null,
      thinking_content: 'Let me search for issues...',
      tool_calls: [
        {id: 'call-1', function: 'telemetry_live_search', args: '{"question":"errors"}'},
      ],
    },
    timestamp: '2024-01-01T00:01:00Z',
    loading: false,
    tool_results: [
      {
        tool_call_id: 'call-1',
        tool_call_function: 'telemetry_live_search',
        content: '{}',
      },
    ],
    tool_links: [{kind: 'telemetry_live_search', params: {}}],
    ...overrides,
  };
}

describe('ToolUseBlock', () => {
  it('renders tool call display text', () => {
    render(<BlockComponent block={createBlock()} blockIndex={0} />);
    expect(screen.getByText(/Queried spans/)).toBeInTheDocument();
  });

  it('renders loading state with spinner', () => {
    const block = createBlock({
      loading: true,
      tool_results: [],
      tool_links: [],
    });
    render(<BlockComponent block={block} blockIndex={0} />);
    expect(screen.getByText(/Querying spans/)).toBeInTheDocument();
  });

  it('renders placeholder when loading with no tool calls', () => {
    const block = createBlock({
      loading: true,
      message: {
        role: 'tool_use',
        content: null,
        tool_calls: null,
      },
    });
    render(<BlockComponent block={block} blockIndex={0} />);
    expect(screen.queryByText(/Queried|Querying/)).not.toBeInTheDocument();
  });

  it('renders thinking disclosure when showThinking is enabled', () => {
    render(<BlockComponent block={createBlock()} blockIndex={0} showThinking />);
    expect(screen.getByText('Thinking')).toBeInTheDocument();
  });

  it('hides thinking disclosure by default', () => {
    render(<BlockComponent block={createBlock()} blockIndex={0} />);
    expect(screen.queryByText('Thinking')).not.toBeInTheDocument();
  });

  it('renders errored tool calls', () => {
    const block = createBlock({
      tool_links: [{kind: 'telemetry_live_search', params: {is_error: true}}],
    });
    render(<BlockComponent block={block} blockIndex={0} />);
    expect(screen.getByText(/Queried spans/)).toBeInTheDocument();
  });

  it('renders todo list for todo_write tool calls', () => {
    const block = createBlock({
      message: {
        role: 'tool_use',
        content: null,
        tool_calls: [{id: 'call-1', function: 'todo_write', args: '{}'}],
      },
      tool_results: [
        {tool_call_id: 'call-1', tool_call_function: 'todo_write', content: '{}'},
      ],
      tool_links: [{kind: 'todo_write', params: {summary: 'Updated todo list'}}],
      todos: [
        {content: 'Fix the bug', status: 'completed'},
        {content: 'Write tests', status: 'in_progress'},
        {content: 'Deploy', status: 'pending'},
      ],
    });

    const blocks = [block];
    render(<BlockComponent block={block} blockIndex={0} blocks={blocks} />);

    expect(screen.getByText('Fix the bug')).toBeInTheDocument();
    expect(screen.getByText('Write tests')).toBeInTheDocument();
    expect(screen.getByText('Deploy')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
    expect(checkboxes[2]).not.toBeChecked();
  });

  it('renders todo list for Code Mode (non-todo_write) tool calls', () => {
    // Code Mode's execute tool projects its todos onto block.todos; the checklist should
    // render even though the tool is not todo_write (code-mode-effects-bus).
    const block = createBlock({
      message: {
        role: 'tool_use',
        content: null,
        tool_calls: [{id: 'call-1', function: 'sentry_api_execute', args: '{}'}],
      },
      tool_results: [
        {
          tool_call_id: 'call-1',
          tool_call_function: 'sentry_api_execute',
          content: 'ran',
        },
      ],
      todos: [
        {content: 'Investigate p95', status: 'in_progress'},
        {content: 'Propose a fix', status: 'pending'},
      ],
    });

    const blocks = [block];
    render(<BlockComponent block={block} blockIndex={0} blocks={blocks} />);

    expect(screen.getByText('Investigate p95')).toBeInTheDocument();
    expect(screen.getByText('Propose a fix')).toBeInTheDocument();
  });

  it('renders the links bus from a Code Mode execute (many links, one result)', () => {
    // seer carries a result's deep-links on its structuredContent.links; a Code Mode execute can
    // produce many, and each renders as a labeled link (code-mode-effects-registry).
    const block = createBlock({
      message: {
        role: 'tool_use',
        content: null,
        tool_calls: [{id: 'call-1', function: 'sentry_api_execute', args: '{}'}],
      },
      tool_results: [
        {
          tool_call_id: 'call-1',
          tool_call_function: 'sentry_api_execute',
          content: 'ran',
          structuredContent: {
            links: [
              {kind: 'get_issue_details', params: {issue_id: '123'}},
              {kind: 'get_trace_waterfall', params: {trace_id: 'abc'}},
            ],
          },
        },
      ],
    });

    render(<BlockComponent block={block} blockIndex={0} blocks={[block]} />);

    expect(screen.getByText('View issue')).toBeInTheDocument();
    expect(screen.getByText('View trace')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /View issue/})).toHaveAttribute(
      'href',
      expect.stringContaining('/issues/123/')
    );
  });

  it('does not double-render a classic link present in both channels', () => {
    // A classic tool populates both the positional tool_links (row link) and structuredContent.links
    // during migration; the bus entry that duplicates the row link is deduped, so it renders once.
    const block = createBlock({
      tool_results: [
        {
          tool_call_id: 'call-1',
          tool_call_function: 'telemetry_live_search',
          content: '{}',
          structuredContent: {
            links: [{kind: 'telemetry_live_search', params: {}}],
          },
        },
      ],
    });

    render(<BlockComponent block={block} blockIndex={0} blocks={[block]} />);

    // The row link renders (from the positional channel) and is the only link: a failed dedupe
    // would add a second one below labeled with the raw kind (telemetry_live_search has no
    // NAV_LINK_LABELS entry), so assert on the link count rather than an unrelated label.
    expect(screen.getByText(/Queried spans/)).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByText('telemetry_live_search')).not.toBeInTheDocument();
  });

  it('does not render bus links for errored results', () => {
    // getValidToolLinks drops errored links from the positional channel; the bus applies the same
    // rule, so a failed tool never surfaces a labeled nav link.
    const block = createBlock({
      tool_results: [
        {
          tool_call_id: 'call-1',
          tool_call_function: 'telemetry_live_search',
          content: '{}',
          structuredContent: {
            links: [
              {kind: 'get_issue_details', params: {issue_id: '123', is_error: true}},
              {kind: 'get_trace_waterfall', params: {trace_id: 'abc'}},
            ],
          },
        },
      ],
    });

    render(<BlockComponent block={block} blockIndex={0} blocks={[block]} />);

    expect(screen.queryByText('View issue')).not.toBeInTheDocument();
    expect(screen.getByText('View trace')).toBeInTheDocument();
  });

  // The dedupe key is derived from the link's own params, and the bus drops errored links before
  // deduping. These cases pin down the interaction between those two rules — in particular that an
  // errored tool call never surfaces a link through either channel, which is the invariant the
  // positional channel has always had (getValidToolLinks drops is_error links).
  describe('errored links across both channels', () => {
    it('renders no link when a classic tool errors (seer writes is_error to both channels)', () => {
      // seer derives the positional ToolLink and the classic bus entry from the same `metadata`
      // dict (explorer_agent lifts one into structuredContent["links"] and appends the other to
      // block.tool_links), so is_error is present in both or neither. This is the shape a real
      // errored classic tool produces.
      const erroredParams = {query: 'errors', is_error: true};
      const block = createBlock({
        tool_links: [{kind: 'telemetry_live_search', params: erroredParams}],
        tool_results: [
          {
            tool_call_id: 'call-1',
            tool_call_function: 'telemetry_live_search',
            content: '{}',
            structuredContent: {
              links: [{kind: 'telemetry_live_search', params: erroredParams}],
            },
          },
        ],
      });

      render(<BlockComponent block={block} blockIndex={0} blocks={[block]} />);

      // The row still describes the call, but nothing is clickable through either channel.
      expect(screen.getByText(/Queried spans/)).toBeInTheDocument();
      expect(screen.queryAllByRole('link')).toHaveLength(0);
    });

    it('renders no link when a Code Mode execute errors', () => {
      // sentry_api_execute returns {is_error: True} metadata and never publishes the drained
      // links on its failure path, so the only bus entry is the errored one seer appends.
      const block = createBlock({
        message: {
          role: 'tool_use',
          content: null,
          tool_calls: [{id: 'call-1', function: 'sentry_api_execute', args: '{}'}],
        },
        tool_links: [{kind: 'sentry_api_execute', params: {is_error: true}}],
        tool_results: [
          {
            tool_call_id: 'call-1',
            tool_call_function: 'sentry_api_execute',
            content: 'Error executing code:\nboom',
            structuredContent: {
              links: [{kind: 'sentry_api_execute', params: {is_error: true}}],
            },
          },
        ],
      });

      render(<BlockComponent block={block} blockIndex={0} blocks={[block]} />);

      expect(screen.queryAllByRole('link')).toHaveLength(0);
    });

    it('renders no link when only the positional channel carries is_error', () => {
      // Defensive: if the two channels ever disagree about a link's error state (they cannot
      // today — both read the same params dict), the errored tool must still not surface a link.
      // The dedupe key ignores is_error so the twin is matched regardless of which side flags it.
      const block = createBlock({
        tool_links: [
          {kind: 'get_issue_details', params: {issue_id: '123', is_error: true}},
        ],
        tool_results: [
          {
            tool_call_id: 'call-1',
            tool_call_function: 'get_issue_details',
            content: '{}',
            structuredContent: {
              links: [{kind: 'get_issue_details', params: {issue_id: '123'}}],
            },
          },
        ],
      });

      render(<BlockComponent block={block} blockIndex={0} blocks={[block]} />);

      expect(screen.queryByText('View issue')).not.toBeInTheDocument();
      expect(screen.queryAllByRole('link')).toHaveLength(0);
    });

    it('renders the row link once when only the bus channel carries is_error', () => {
      // The mirror of the case above. The positional channel is the source of truth for the row
      // link, so a non-errored positional link still renders; the errored bus twin is dropped
      // rather than added below it. Either way the link surfaces exactly once, never twice.
      const block = createBlock({
        tool_links: [{kind: 'get_issue_details', params: {issue_id: '123'}}],
        tool_results: [
          {
            tool_call_id: 'call-1',
            tool_call_function: 'get_issue_details',
            content: '{}',
            structuredContent: {
              links: [
                {kind: 'get_issue_details', params: {issue_id: '123', is_error: true}},
              ],
            },
          },
        ],
      });

      render(<BlockComponent block={block} blockIndex={0} blocks={[block]} />);

      expect(screen.getAllByRole('link')).toHaveLength(1);
    });

    it('keeps unrelated bus links when one bus link is errored', () => {
      // Dropping an errored link must not drop its siblings on the same result.
      const block = createBlock({
        message: {
          role: 'tool_use',
          content: null,
          tool_calls: [{id: 'call-1', function: 'sentry_api_execute', args: '{}'}],
        },
        tool_links: [null],
        tool_results: [
          {
            tool_call_id: 'call-1',
            tool_call_function: 'sentry_api_execute',
            content: 'ran',
            structuredContent: {
              links: [
                {kind: 'get_issue_details', params: {issue_id: '123', is_error: true}},
                {kind: 'get_trace_waterfall', params: {trace_id: 'abc'}},
                {
                  kind: 'get_replay_details',
                  params: {replay_id: 'def', project_slug: 'p'},
                },
              ],
            },
          },
        ],
      });

      render(<BlockComponent block={block} blockIndex={0} blocks={[block]} />);

      expect(screen.queryByText('View issue')).not.toBeInTheDocument();
      expect(screen.getByText('View trace')).toBeInTheDocument();
      expect(screen.getByText('View replay')).toBeInTheDocument();
    });

    it('dedupes a twin whose params are in a different key order', () => {
      // linkKey sorts params, so the dedupe does not depend on JSON key order across channels.
      const block = createBlock({
        tool_links: [
          {kind: 'get_issue_details', params: {issue_id: '123', project_slug: 'p'}},
        ],
        tool_results: [
          {
            tool_call_id: 'call-1',
            tool_call_function: 'get_issue_details',
            content: '{}',
            structuredContent: {
              links: [
                // Same link, keys declared in the opposite order.
                {kind: 'get_issue_details', params: {project_slug: 'p', issue_id: '123'}},
              ],
            },
          },
        ],
      });

      render(<BlockComponent block={block} blockIndex={0} blocks={[block]} />);

      expect(screen.getAllByRole('link')).toHaveLength(1);
    });
  });

  it('renders per-row channels in a mixed block (classic positional + Code Mode bus)', () => {
    // One block, two tool calls: a classic tool renders via the positional tool_links row link,
    // and a Code Mode execute renders its links from structuredContent — each row independent.
    const block = createBlock({
      message: {
        role: 'tool_use',
        content: null,
        tool_calls: [
          {id: 'call-1', function: 'telemetry_live_search', args: '{}'},
          {id: 'call-2', function: 'sentry_api_execute', args: '{}'},
        ],
      },
      tool_results: [
        {
          tool_call_id: 'call-1',
          tool_call_function: 'telemetry_live_search',
          content: '{}',
        },
        {
          tool_call_id: 'call-2',
          tool_call_function: 'sentry_api_execute',
          content: 'ran',
          structuredContent: {
            links: [{kind: 'get_issue_details', params: {issue_id: '123'}}],
          },
        },
      ],
      // Positional link for the classic call only; the execute has none.
      tool_links: [{kind: 'telemetry_live_search', params: {}}, null],
    });

    const blocks = [block];
    render(<BlockComponent block={block} blockIndex={0} blocks={blocks} />);

    // Classic row renders via the positional channel.
    expect(screen.getByText(/Queried spans/)).toBeInTheDocument();
    // Code Mode row renders its link from the bus.
    expect(screen.getByRole('link', {name: /View issue/})).toHaveAttribute(
      'href',
      expect.stringContaining('/issues/123/')
    );
  });

  it('falls back to the positional link when a result has no bus links', () => {
    // No structuredContent on the result (older seer): the row renders from tool_links.
    const block = createBlock(); // default: telemetry_live_search + positional tool_link, no bus
    render(<BlockComponent block={block} blockIndex={0} blocks={[block]} />);
    expect(screen.getByRole('link', {name: /Queried spans/})).toBeInTheDocument();
  });

  it('does not render action bar', () => {
    render(<BlockComponent block={createBlock()} blockIndex={0} runId={123} />);
    expect(
      screen.queryByRole('button', {name: 'I like this response'})
    ).not.toBeInTheDocument();
  });
});
