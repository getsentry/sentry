import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {Block} from 'sentry/views/seerExplorer/types';

import {groupTranscript, ResponseGroup} from './responseGroup';

function userBlock(id: string, content: string): Block {
  return {
    id,
    message: {role: 'user', content},
    timestamp: '2024-01-01T00:00:00Z',
    loading: false,
  };
}

function toolUseBlock(
  id: string,
  overrides?: Partial<Block['message']> & {loading?: boolean}
): Block {
  const {loading = false, ...message} = overrides ?? {};
  return {
    id,
    message: {
      role: 'tool_use',
      content: null,
      tool_calls: [{id: `${id}-call`, function: 'telemetry_live_search', args: '{}'}],
      ...message,
    },
    timestamp: '2024-01-01T00:01:00Z',
    loading,
    tool_results: [
      {
        tool_call_id: `${id}-call`,
        tool_call_function: 'telemetry_live_search',
        content: '{}',
      },
    ],
    tool_links: [{kind: 'telemetry_live_search', params: {}}],
  };
}

function assistantBlock(id: string, content: string, loading = false): Block {
  return {
    id,
    message: {role: 'assistant', content, tool_calls: null},
    timestamp: '2024-01-01T00:02:00Z',
    loading,
  };
}

describe('groupTranscript', () => {
  it('keeps user blocks as their own segments', () => {
    const segments = groupTranscript([userBlock('u1', 'hi')]);
    expect(segments).toEqual([{kind: 'user', block: expect.anything(), index: 0}]);
  });

  it('groups a run of tool_use + assistant blocks after a user block into one response', () => {
    const blocks = [
      userBlock('u1', 'hi'),
      toolUseBlock('t1'),
      toolUseBlock('t2'),
      assistantBlock('a1', 'the answer'),
    ];

    const segments = groupTranscript(blocks);

    expect(segments).toHaveLength(2);
    expect(segments[0]!.kind).toBe('user');
    const response = segments[1]!;
    expect(response.kind).toBe('response');
    expect(response.kind === 'response' && response.indices).toEqual([1, 2, 3]);
  });

  it('starts a new response after each user block', () => {
    const blocks = [
      userBlock('u1', 'q1'),
      assistantBlock('a1', 'a1'),
      userBlock('u2', 'q2'),
      toolUseBlock('t1'),
      assistantBlock('a2', 'a2'),
    ];

    const segments = groupTranscript(blocks);

    expect(segments.map(s => s.kind)).toEqual(['user', 'response', 'user', 'response']);
  });
});

describe('ResponseGroup', () => {
  const organization = OrganizationFixture();

  it('renders a single ThinkingBlock for a multi-step response, with the answer outside it', () => {
    const group = [
      toolUseBlock('t1'),
      toolUseBlock('t2'),
      assistantBlock('a1', 'The final answer'),
    ];

    render(<ResponseGroup group={group} blockIndex={1} blocks={group} showThinking />, {
      organization,
    });

    // One consolidated "Thinking" block for the whole response — not one per step.
    expect(screen.getAllByText('Thinking')).toHaveLength(1);
    // The final answer is hoisted out of the collapsible reasoning.
    expect(screen.getByText('The final answer')).toBeInTheDocument();
  });

  it('collapses the tool calls into the ThinkingBlock until it is expanded', async () => {
    const group = [toolUseBlock('t1'), assistantBlock('a1', 'Done')];

    render(<ResponseGroup group={group} blockIndex={1} blocks={group} showThinking />, {
      organization,
    });

    // A completed response's ThinkingBlock starts collapsed, so the tool row is hidden.
    expect(screen.getByText(/Queried spans/)).not.toBeVisible();

    await userEvent.click(screen.getByRole('button', {name: /Thinking/}));

    expect(screen.getByText(/Queried spans/)).toBeVisible();
  });

  it('renders no ThinkingBlock when the response is a direct answer with no reasoning', () => {
    const group = [assistantBlock('a1', 'Just an answer')];

    render(<ResponseGroup group={group} blockIndex={0} blocks={group} showThinking />, {
      organization,
    });

    expect(screen.queryByText('Thinking')).not.toBeInTheDocument();
    expect(screen.getByText('Just an answer')).toBeInTheDocument();
  });

  it('gates thinking prose on the showThinking toggle but keeps tool calls', async () => {
    const group = [
      toolUseBlock('t1', {thinking_content: 'my private reasoning'}),
      assistantBlock('a1', 'Answer'),
    ];

    render(
      <ResponseGroup group={group} blockIndex={1} blocks={group} showThinking={false} />,
      {
        organization,
      }
    );

    await userEvent.click(screen.getByRole('button', {name: /Thinking/}));

    expect(screen.queryByText('my private reasoning')).not.toBeInTheDocument();
    expect(screen.getByText(/Queried spans/)).toBeInTheDocument();
  });
});
