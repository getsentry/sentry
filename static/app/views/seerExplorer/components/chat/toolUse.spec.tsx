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

  it('does not render action bar', () => {
    render(<BlockComponent block={createBlock()} blockIndex={0} runId={123} />);
    expect(
      screen.queryByRole('button', {name: 'I like this response'})
    ).not.toBeInTheDocument();
  });
});
