import type {ComponentProps} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {getToolOutputBytes} from 'sentry/views/insights/pages/agents/utils/getToolOutputBytes';
import {
  AIOutputSection,
  formatAIToolOutput,
  getAIToolOutput,
  hasAIOutputAttribute,
} from 'sentry/views/performance/traceDetails/traceDrawer/details/span/eapSections/aiOutput';

function makeAiNodeWithAttributes(
  attributes: Record<string, unknown>
): ComponentProps<typeof AIOutputSection>['node'] {
  return {
    id: 'span-id',
    attributes: {
      'gen_ai.operation.type': 'chat',
      ...attributes,
    },
    value: {},
  } as unknown as ComponentProps<typeof AIOutputSection>['node'];
}

function makeAiNode(
  messages: Array<{role: string; content?: unknown; parts?: unknown[]}>
): ComponentProps<typeof AIOutputSection>['node'] {
  return makeAiNodeWithAttributes({
    'gen_ai.output.messages': JSON.stringify(messages),
  });
}

describe('AIOutputSection', () => {
  it('renders Anthropic tool content blocks readably', () => {
    const node = makeAiNodeWithAttributes({
      'gen_ai.operation.type': 'execute_tool',
      'anthropic.tool_result.content': JSON.stringify([
        {type: 'text', text: 'First result'},
        {type: 'text', text: 'Second result'},
      ]),
    });
    expect(hasAIOutputAttribute(node)).toBe(true);
    render(<AIOutputSection node={node} />);
    expect(screen.getByText(/First result/)).toBeVisible();
    expect(screen.getByText(/Second result/)).toBeVisible();
    expect(screen.queryByText('type')).not.toBeInTheDocument();
  });

  it.each([
    [{'gen_ai.tool.call.result': 'standard'}, 'standard'],
    [{}, 'Anthropic'],
    [{'gen_ai.tool.call.result': ''}, ''],
  ])('matches tool output and byte metadata (%j)', (attributes, expected) => {
    const node = makeAiNodeWithAttributes({
      'anthropic.tool_result.content': 'Anthropic',
      'gen_ai.tool.output': 'legacy',
      ...attributes,
    });
    expect(getAIToolOutput(node)).toBe(expected);
    expect(getToolOutputBytes(node)).toBe(new TextEncoder().encode(expected).length);
  });

  it('retains the legacy tool output fallback', () => {
    const node = makeAiNodeWithAttributes({'gen_ai.tool.output': 'legacy'});
    expect(getAIToolOutput(node)).toBe('legacy');
    expect(getToolOutputBytes(node)).toBe(6);
  });

  it('uses fetched span attributes for the Anthropic fallback', () => {
    const node = makeAiNodeWithAttributes({});
    expect(
      getAIToolOutput(node, [
        {name: 'anthropic.tool_result.content', value: 'fetched result', type: 'str'},
      ])
    ).toBe('fetched result');
  });

  it.each([
    'plain text',
    '{"answer":42}',
    '[]',
    '[1,2]',
    '[{"type":"image","source":{"data":"unsupported"}}]',
    '[{"type":"text","text":"known"},{"type":"unknown","data":"keep me"}]',
    '[{"type":"text","text":"truncated"',
  ])('preserves non-content-block or unsupported output: %s', output => {
    expect(formatAIToolOutput(output)).toBe(output);
  });

  it('normalizes blocks without changing raw byte counts', () => {
    const raw = JSON.stringify([
      {type: 'text', text: '你好'},
      {type: 'text', text: 'result'},
    ]);
    const node = makeAiNodeWithAttributes({'anthropic.tool_result.content': raw});
    expect(formatAIToolOutput(raw)).toBe('你好\nresult');
    expect(getToolOutputBytes(node)).toBe(new TextEncoder().encode(raw).length);
  });

  it('renders reasoning output under a Thinking label', () => {
    render(
      <AIOutputSection
        node={makeAiNode([
          {
            role: 'assistant',
            parts: [
              {type: 'reasoning', content: 'Let me think step by step...'},
              {type: 'text', content: 'The answer is 42'},
            ],
          },
        ])}
      />
    );

    expect(screen.getByText('Thinking')).toBeInTheDocument();
    expect(screen.getByText('Let me think step by step...')).toBeVisible();
    expect(screen.getByText('Response')).toBeInTheDocument();
    expect(screen.getByText('The answer is 42')).toBeVisible();
  });

  it('renders reasoning from a realistic payload with braces and code', () => {
    const reasoning =
      'Let me analyze this error. The issue is ALTITUDE-69 with title "Error: {" which is a bit cryptic.\n\nThe actual error is an `AbortError` serialized as `{"name": "AbortError", "message": "Aborted"}`.';
    const response =
      'This is an **`AbortError`** being incorrectly captured by the logger.';

    render(
      <AIOutputSection
        node={makeAiNode([
          {
            role: 'assistant',
            parts: [
              {type: 'reasoning', content: reasoning},
              {type: 'text', content: response},
            ],
          },
        ])}
      />
    );

    expect(screen.getByText('Thinking')).toBeInTheDocument();
    expect(screen.getByText(/Let me analyze this error/)).toBeVisible();
  });

  it('renders reasoning even when there is no response text', () => {
    render(
      <AIOutputSection
        node={makeAiNode([
          {
            role: 'assistant',
            parts: [{type: 'reasoning', content: 'Thinking only...'}],
          },
        ])}
      />
    );

    expect(screen.getByText('Thinking')).toBeInTheDocument();
    expect(screen.getByText('Thinking only...')).toBeVisible();
    expect(screen.queryByText('Response')).not.toBeInTheDocument();
  });

  it('does not render a Thinking label when there is no reasoning', () => {
    render(
      <AIOutputSection
        node={makeAiNode([{role: 'assistant', content: 'Just a response'}])}
      />
    );

    expect(screen.getByText('Just a response')).toBeVisible();
    expect(screen.queryByText('Thinking')).not.toBeInTheDocument();
  });
});
