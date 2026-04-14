import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TimezoneProvider} from 'sentry/components/timezoneProvider';
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
  it('shows when the conversation started and when the last message happened', () => {
    const firstNode = createMockNode({
      id: 'span-1',
      startTimestamp: 1476662480,
      endTimestamp: 1476662540,
    });
    const secondNode = createMockNode({
      id: 'span-2',
      startTimestamp: 1476662600,
      endTimestamp: 1508208080,
    });

    render(
      <TimezoneProvider timezone="America/Los_Angeles">
        <ConversationSummary
          conversationId="conversation-1234"
          nodes={[firstNode, secondNode] as any}
        />
      </TimezoneProvider>
    );

    expect(screen.getByText('Started')).toBeInTheDocument();
    expect(screen.getByText('Oct 16, 2016 7:41 PM PDT')).toBeInTheDocument();
    expect(screen.getByText('Last message')).toBeInTheDocument();
    expect(screen.getByText(/ago$/)).toBeInTheDocument();
  });
});
