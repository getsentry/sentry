import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TraceAiConversations} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceAiConversations';

jest.mock(
  'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceAiSpans',
  () => ({AiSpansSplitView: () => <div>timeline-content</div>})
);

const CONVERSATION_ID = 'conversation-1';

function renderTraceAiConversations() {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/agents/conversations/${CONVERSATION_ID}/`,
    body: {conversationId: CONVERSATION_ID, title: null, spans: []},
  });

  return render(
    <TraceAiConversations
      conversationIds={[CONVERSATION_ID]}
      allAiNodes={[]}
      traceSlug="trace-1"
    />,
    {organization: OrganizationFixture()}
  );
}

describe('TraceAiConversations', () => {
  it('opens the timeline by default', () => {
    renderTraceAiConversations();

    expect(screen.getByRole('tab', {name: 'Timeline'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText('timeline-content')).toBeInTheDocument();
  });
});
