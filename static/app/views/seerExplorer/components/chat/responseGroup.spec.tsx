import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {Block} from 'sentry/views/seerExplorer/types';

import {groupTranscript, deriveThinkingTitle, ResponseGroup} from './responseGroup';

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

describe('deriveThinkingTitle', () => {
  it('summarizes the response with the latest tool activity', () => {
    const group = [toolUseBlock('t1'), assistantBlock('a1', 'answer')];
    // telemetry_live_search settles to "Queried spans" (see getToolsStringFromBlock).
    expect(deriveThinkingTitle(group)).toMatch(/Queried spans/);
  });

  it('falls back to "Thinking" before any tool has run', () => {
    expect(deriveThinkingTitle([assistantBlock('a1', 'answer')])).toBe('Thinking');
  });
});

describe('ResponseGroup', () => {
  const organization = OrganizationFixture();

  it('renders a single reasoning block titled by the latest activity, answer outside it', () => {
    const group = [
      toolUseBlock('t1'),
      toolUseBlock('t2'),
      assistantBlock('a1', 'The final answer'),
    ];

    render(<ResponseGroup group={group} blockIndex={1} blocks={group} showThinking />, {
      organization,
    });

    // One consolidated reasoning toggle for the whole response, titled by the latest activity.
    expect(screen.getByRole('button', {name: /Queried spans/})).toBeInTheDocument();
    // The final answer is hoisted out of the collapsible reasoning.
    expect(screen.getByText('The final answer')).toBeInTheDocument();
  });

  it('collapses the reasoning until it is expanded', async () => {
    const group = [
      toolUseBlock('t1', {thinking_content: 'my private reasoning'}),
      assistantBlock('a1', 'Done'),
    ];

    render(<ResponseGroup group={group} blockIndex={1} blocks={group} showThinking />, {
      organization,
    });

    // A completed response's reasoning starts collapsed, so the thinking prose is hidden.
    expect(screen.getByText('my private reasoning')).not.toBeVisible();

    await userEvent.click(screen.getByRole('button', {name: /Queried spans/}));

    expect(screen.getByText('my private reasoning')).toBeVisible();
  });

  it('renders no reasoning block when the response is a direct answer', () => {
    const group = [assistantBlock('a1', 'Just an answer')];

    render(<ResponseGroup group={group} blockIndex={0} blocks={group} showThinking />, {
      organization,
    });

    expect(
      screen.queryByRole('button', {name: /Thinking|Queried/})
    ).not.toBeInTheDocument();
    expect(screen.getByText('Just an answer')).toBeInTheDocument();
  });

  it('gates thinking prose on the showThinking toggle but keeps tool calls', async () => {
    const group = [
      toolUseBlock('t1', {thinking_content: 'my private reasoning'}),
      assistantBlock('a1', 'Answer'),
    ];

    render(
      <ResponseGroup group={group} blockIndex={1} blocks={group} showThinking={false} />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: /Queried spans/}));

    expect(screen.queryByText('my private reasoning')).not.toBeInTheDocument();
    // The tool call row still renders (as its own link), just without the reasoning prose.
    expect(screen.getByRole('link', {name: /Queried spans/})).toBeInTheDocument();
  });
});
