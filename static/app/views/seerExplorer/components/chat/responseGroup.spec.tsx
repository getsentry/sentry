import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {Block} from 'sentry/views/seerExplorer/types';

import {groupTranscript, deriveThinkingTitle, ResponseGroup} from './responseGroup';
import {findLatestTodos} from './toolUse';

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

/**
 * Seer's global LLM-wait placeholder: `loading` with no tool calls. The backend sends
 * `content: 'Thinking...'` but `normalizeBlocks` strips it to `null` at the API boundary.
 */
function llmWaitBlock(): Block {
  return {
    id: 'loading',
    message: {role: 'assistant', content: null, tool_calls: null},
    timestamp: '2024-01-01T00:02:00Z',
    loading: true,
  };
}

/**
 * The response's `ThinkingBlock`. Located structurally rather than by title: the header shows the
 * live tool label while active but a static summary once settled, so a title match silently stops
 * meaning "the box is open".
 */
function queryReasoningBox(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-disclosure]');
}

function reasoningBox(container: HTMLElement): HTMLElement {
  const box = queryReasoningBox(container);
  if (!box) {
    throw new Error('no reasoning box rendered');
  }
  return box;
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
  it('uses the latest complete summary ahead of tool activity', () => {
    const group = [
      toolUseBlock('t1', {
        content:
          '{% tool_summary %}Checking the issue details{% /tool_summary %}{% tool_summary %}Comparing related errors{% /tool_summary %}',
      }),
      toolUseBlock('t2'),
    ];

    expect(deriveThinkingTitle(group)).toBe('Comparing related errors');
  });

  it('ignores a summary that is still streaming', () => {
    const group = [toolUseBlock('t1', {content: '{% tool_summary %}Checking the'})];

    expect(deriveThinkingTitle(group)).toMatch(/Queried spans/);
  });

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

  it('uses the summary as the completed title and leaves no embed content', async () => {
    const summary = 'Checking the issue details';
    const group = [
      toolUseBlock('t1', {
        content: `{% tool_summary %}${summary}{% /tool_summary %}`,
      }),
      assistantBlock('a1', 'The final answer'),
    ];

    const {container} = render(
      <ResponseGroup group={group} blockIndex={1} blocks={group} />,
      {organization}
    );

    expect(reasoningBox(container).querySelector('button')).toHaveTextContent(summary);
    await userEvent.click(reasoningBox(container).querySelector('button')!);
    expect(
      within(reasoningBox(container).querySelector('[role="group"]')!).queryByText(
        summary
      )
    ).not.toBeInTheDocument();
    expect(screen.getByText('The final answer')).toBeInTheDocument();
  });

  it('renders only the title for a completed summary alone', () => {
    const group = [
      assistantBlock(
        'a1',
        '{% tool_summary %}Checking the issue details{% /tool_summary %}'
      ),
    ];

    const {container} = render(
      <ResponseGroup group={group} blockIndex={1} blocks={group} />,
      {organization}
    );

    expect(reasoningBox(container).querySelector('button')).toHaveTextContent(
      'Checking the issue details'
    );
    expect(within(reasoningBox(container)).queryByRole('group')).not.toBeInTheDocument();
  });

  it('renders a single reasoning block titled by the latest activity, answer outside it', () => {
    const group = [
      toolUseBlock('t1'),
      toolUseBlock('t2'),
      assistantBlock('a1', 'The final answer'),
    ];

    render(
      <ResponseGroup
        group={group}
        blockIndex={1}
        latestTodos={findLatestTodos(group)}
        showThinking
      />,
      {
        organization,
      }
    );

    // One consolidated reasoning toggle for the whole response.
    expect(
      screen.getByRole('button', {name: /See thinking and tool calls/})
    ).toBeInTheDocument();
    // The final answer is hoisted out of the collapsible reasoning.
    expect(screen.getByText('The final answer')).toBeInTheDocument();
  });

  it('does not open a reasoning box for a call that renders nothing', () => {
    // `ToolCallList` suppresses a settled call that reported no rows, links, todos or markdown.
    // Counting it as a trace anyway left an empty box between the previous answer and the next
    // spinner.
    const group: Block[] = [
      {
        id: 't1',
        message: {
          role: 'tool_use',
          content: null,
          tool_calls: [{id: 't1-call', function: 'sentry_api_execute', args: '{}'}],
        },
        timestamp: '2024-01-01T00:01:00Z',
        loading: false,
        tool_results: [
          {
            tool_call_id: 't1-call',
            tool_call_function: 'sentry_api_execute',
            content: 'ok',
            structuredContent: null,
          },
        ],
      },
    ];

    const {container} = render(
      <ResponseGroup
        group={group}
        blockIndex={1}
        latestTodos={findLatestTodos(group)}
        showThinking
      />,
      {organization}
    );

    expect(queryReasoningBox(container)).not.toBeInTheDocument();
  });

  it('still opens the box when the call reported call records', () => {
    const group: Block[] = [
      {
        id: 't1',
        message: {
          role: 'tool_use',
          content: null,
          tool_calls: [{id: 't1-call', function: 'sentry_api_execute', args: '{}'}],
        },
        timestamp: '2024-01-01T00:01:00Z',
        loading: false,
        tool_results: [
          {
            tool_call_id: 't1-call',
            tool_call_function: 'sentry_api_execute',
            content: 'ok',
            structuredContent: {
              calls: [{id: 1, kind: 'api', title: 'Retrieving issue 4521'}],
            },
          },
        ],
      },
    ];

    const {container} = render(
      <ResponseGroup
        group={group}
        blockIndex={1}
        latestTodos={findLatestTodos(group)}
        showThinking
      />,
      {organization}
    );

    expect(queryReasoningBox(container)).toBeInTheDocument();
  });

  it('still opens the box for a classic tool call', () => {
    const group = [toolUseBlock('t1')];

    const {container} = render(
      <ResponseGroup
        group={group}
        blockIndex={1}
        latestTodos={findLatestTodos(group)}
        showThinking
      />,
      {organization}
    );

    expect(queryReasoningBox(container)).toBeInTheDocument();
  });

  it('collapses the reasoning until it is expanded', async () => {
    const group = [
      toolUseBlock('t1', {thinking_content: 'my private reasoning'}),
      assistantBlock('a1', 'Done'),
    ];

    render(
      <ResponseGroup
        group={group}
        blockIndex={1}
        latestTodos={findLatestTodos(group)}
        showThinking
      />,
      {
        organization,
      }
    );

    // A completed response's reasoning starts collapsed, so the thinking prose is hidden.
    expect(screen.getByText('my private reasoning')).not.toBeVisible();

    await userEvent.click(
      screen.getByRole('button', {name: /See thinking and tool calls/})
    );

    expect(screen.getByText('my private reasoning')).toBeVisible();
  });

  it('stays expanded between tool calls while the agent works', () => {
    // Between tool calls seer appends its LLM-wait placeholder. The response is still in
    // progress (no answer yet), so the ThinkingBlock stays expanded to avoid flash.
    const group = [toolUseBlock('t1'), llmWaitBlock()];

    const {container} = render(
      <ResponseGroup
        group={group}
        blockIndex={1}
        latestTodos={findLatestTodos(group)}
        showThinking
      />,
      {organization}
    );

    expect(reasoningBox(container).querySelector('button')).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('stays expanded in the gap between tool calls when no block is loading', () => {
    // CW-2044: between tool calls, the backend briefly returns all blocks with
    // loading: false before the next tool starts. The ThinkingBlock must stay
    // expanded as long as no final answer has settled.
    const group = [toolUseBlock('t1'), toolUseBlock('t2')];

    const {container} = render(
      <ResponseGroup
        group={group}
        blockIndex={1}
        latestTodos={findLatestTodos(group)}
        showThinking
      />,
      {organization}
    );

    expect(reasoningBox(container).querySelector('button')).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('spins inside the box while a tool works', () => {
    const group = [toolUseBlock('t1', {loading: true})];

    const {container} = render(
      <ResponseGroup
        group={group}
        blockIndex={1}
        latestTodos={findLatestTodos(group)}
        showThinking
      />,
      {organization}
    );

    expect(reasoningBox(container).querySelector('button')).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(reasoningBox(container).contains(screen.getByRole('status'))).toBe(true);
  });

  it('renders no reasoning block when the response is a direct answer', () => {
    const group = [assistantBlock('a1', 'Just an answer')];

    render(
      <ResponseGroup
        group={group}
        blockIndex={0}
        latestTodos={findLatestTodos(group)}
        showThinking
      />,
      {
        organization,
      }
    );

    expect(
      screen.queryByRole('button', {name: /See thinking and tool calls/})
    ).not.toBeInTheDocument();
    expect(screen.getByText('Just an answer')).toBeInTheDocument();
  });

  it('renders a ThinkingBlock placeholder before any trace content arrives', () => {
    const group = [llmWaitBlock()];

    const {container} = render(
      <ResponseGroup group={group} blockIndex={0} latestTodos={findLatestTodos(group)} />,
      {organization}
    );

    expect(queryReasoningBox(container)).toBeInTheDocument();
    // Title only. The panel is the bordered card, so opening it around nothing draws an
    // empty box under "Thinking..." for as long as the agent takes to report anything.
    expect(within(reasoningBox(container)).queryByRole('group')).not.toBeInTheDocument();
  });

  it('gates thinking prose on the showThinking toggle but keeps tool calls', async () => {
    const group = [
      toolUseBlock('t1', {thinking_content: 'my private reasoning'}),
      assistantBlock('a1', 'Answer'),
    ];

    render(
      <ResponseGroup
        group={group}
        blockIndex={1}
        latestTodos={findLatestTodos(group)}
        showThinking={false}
      />,
      {organization}
    );

    await userEvent.click(
      screen.getByRole('button', {name: /See thinking and tool calls/})
    );

    expect(screen.queryByText('my private reasoning')).not.toBeInTheDocument();
    // The tool call row still renders (as its own link), just without the reasoning prose.
    expect(screen.getByRole('link', {name: /Queried spans/})).toBeInTheDocument();
  });
});
