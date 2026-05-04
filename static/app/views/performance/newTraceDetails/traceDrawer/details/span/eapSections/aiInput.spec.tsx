import type {ComponentProps} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AIInputSection} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiInput';

function makeAiNode(
  messages: Array<{content: string; role: string}>
): ComponentProps<typeof AIInputSection>['node'] {
  return {
    id: 'span-id',
    attributes: {
      'gen_ai.operation.type': 'chat',
      'gen_ai.input.messages': JSON.stringify(messages),
    },
    value: {},
  } as ComponentProps<typeof AIInputSection>['node'];
}

describe('AIInputSection', () => {
  it('minimizes system prompt by default while keeping user messages visible', async () => {
    render(
      <AIInputSection
        node={makeAiNode([
          {role: 'system', content: 'System prompt'},
          {role: 'user', content: 'User message'},
        ])}
      />
    );

    expect(screen.getByText('User message')).toBeVisible();
    expect(screen.getByText('System prompt')).not.toBeVisible();

    await userEvent.click(screen.getByRole('button', {name: 'System'}));

    expect(screen.getByText('System prompt')).toBeVisible();
  });
});
