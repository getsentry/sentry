import type {ComponentProps} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AIOutputSection} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiOutput';

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
