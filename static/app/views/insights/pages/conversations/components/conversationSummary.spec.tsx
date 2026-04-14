import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SpanFields} from 'sentry/views/insights/types';

import {ConversationSummary} from './conversationSummary';

function createMockNode(overrides: {
  id: string;
  endTimestamp?: number;
  startTimestamp?: number;
}) {
  const {id, startTimestamp = 1000, endTimestamp = startTimestamp + 120} = overrides;

  return {
    id,
    type: 'span' as const,
    op: 'gen_ai.generate',
    startTimestamp,
    endTimestamp,
    value: {
      start_timestamp: startTimestamp,
      end_timestamp: endTimestamp,
    },
    attributes: {
      [SpanFields.GEN_AI_OPERATION_TYPE]: 'ai_client',
    },
    errors: new Set(),
  };
}

describe('ConversationSummary', () => {
  it('shows the last message timing in the aggregate row', () => {
    const node = createMockNode({
      id: 'span-1',
      startTimestamp: 1476662480,
      endTimestamp: 1508208080,
    });

    render(
      <ConversationSummary conversationId="conversation-1234" nodes={[node] as any} />
    );

    expect(screen.getByText('Last message')).toBeInTheDocument();
    expect(screen.getByText(/ago$/)).toBeInTheDocument();
  });
});
