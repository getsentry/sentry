import type {ComponentProps} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AIInputSection} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiInput';

const originalResizeObserver = window.ResizeObserver;

function makeAiNode(
  messages: Array<{content: unknown; role: string}> | Record<string, unknown>
): ComponentProps<typeof AIInputSection>['node'] {
  return makeAiNodeWithAttributes({
    'gen_ai.input.messages': JSON.stringify(messages),
  });
}

function makeAiNodeWithAttributes(
  attributes: Record<string, unknown>
): ComponentProps<typeof AIInputSection>['node'] {
  return {
    id: 'span-id',
    attributes: {
      'gen_ai.operation.type': 'chat',
      ...attributes,
    },
    value: {},
  } as unknown as ComponentProps<typeof AIInputSection>['node'];
}

class MockResizeObserver {
  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(element: Element) {
    this.callback(
      [
        {
          target: element,
          contentBoxSize: [{blockSize: 300, inlineSize: 0}],
        } as unknown as ResizeObserverEntry,
      ],
      this
    );
  }

  disconnect() {}

  unobserve() {}
}

describe('AIInputSection', () => {
  afterEach(() => {
    window.ResizeObserver = originalResizeObserver;
  });

  it('renders system prompt without a nested disclosure while keeping user messages visible', () => {
    render(
      <AIInputSection
        node={makeAiNode([
          {role: 'system', content: 'System prompt'},
          {role: 'user', content: 'User message'},
        ])}
      />
    );

    expect(screen.getByText('User message')).toBeVisible();
    expect(screen.getByText('System prompt')).toBeVisible();
    expect(screen.queryByRole('button', {name: 'System'})).not.toBeInTheDocument();
  });

  it('clips structured system prompts with show more', () => {
    window.ResizeObserver = MockResizeObserver;

    render(
      <AIInputSection
        node={makeAiNode([
          {
            role: 'system',
            content: {instructions: ['Be concise'], priority: 'high'},
          },
        ])}
      />
    );

    expect(screen.getByText('instructions')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Show More'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'System'})).not.toBeInTheDocument();
  });

  it('clips JSON system instructions with show more', () => {
    window.ResizeObserver = MockResizeObserver;

    render(
      <AIInputSection
        node={makeAiNodeWithAttributes({
          'gen_ai.system_instructions': JSON.stringify([
            {content: 'You are Seer, a powerful AI assistant built by Sentry.'},
          ]),
        })}
      />
    );

    expect(screen.getByText('content')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Show More'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'System'})).not.toBeInTheDocument();
  });
});
