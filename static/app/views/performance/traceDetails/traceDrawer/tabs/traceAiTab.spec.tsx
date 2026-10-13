import {render, screen} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';
import {hasGenAiConversationsFeature} from 'sentry/views/explore/conversations/utils/features';
import {useAITrace} from 'sentry/views/insights/pages/agents/hooks/useAITrace';
import {getStringAttr} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {TraceAiTab} from 'sentry/views/performance/traceDetails/traceDrawer/tabs/traceAiTab';

jest.mock('sentry/utils/analytics');
jest.mock('sentry/views/insights/pages/agents/hooks/useAITrace');
jest.mock('sentry/views/insights/pages/agents/utils/aiTraceNodes');
jest.mock('sentry/views/explore/conversations/utils/features');
jest.mock('sentry/views/performance/traceDetails/traceDrawer/tabs/traceAiSpans', () => ({
  TraceAiSpans: () => <div>ai-spans</div>,
}));
jest.mock(
  'sentry/views/performance/traceDetails/traceDrawer/tabs/traceAiConversations',
  () => ({
    TraceAiConversations: ({conversationIds}: {conversationIds: string[]}) => (
      <div>ai-conversations-{conversationIds.length}</div>
    ),
  })
);

const mockUseAITrace = jest.mocked(useAITrace);
const mockGetStringAttr = jest.mocked(getStringAttr);
const mockHasConversations = jest.mocked(hasGenAiConversationsFeature);
const mockTrackAnalytics = jest.mocked(trackAnalytics);

describe('TraceAiTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasConversations.mockReturnValue(false);
    mockGetStringAttr.mockReturnValue(undefined);
  });

  it('fires trace.rendered exactly once across the loading -> conversations swap', () => {
    mockUseAITrace.mockReturnValue({nodes: [], isLoading: true, error: false});
    const {rerender} = render(<TraceAiTab traceSlug="trace-slug" />);
    expect(mockTrackAnalytics).not.toHaveBeenCalled();

    mockHasConversations.mockReturnValue(true);
    mockGetStringAttr.mockReturnValue('conversation-1');
    mockUseAITrace.mockReturnValue({
      nodes: [{} as AITraceSpanNode],
      isLoading: false,
      error: false,
    });
    rerender(<TraceAiTab traceSlug="trace-slug" />);

    expect(screen.getByText('ai-conversations-1')).toBeInTheDocument();
    expect(mockTrackAnalytics).toHaveBeenCalledTimes(1);
    expect(mockTrackAnalytics).toHaveBeenCalledWith(
      'agent-monitoring.trace.rendered',
      expect.anything()
    );

    rerender(<TraceAiTab traceSlug="trace-slug" />);
    expect(mockTrackAnalytics).toHaveBeenCalledTimes(1);
  });

  it('renders a trace-local transcript without a conversation id', () => {
    mockUseAITrace.mockReturnValue({
      nodes: [{} as AITraceSpanNode],
      isLoading: false,
      error: false,
    });

    render(<TraceAiTab traceSlug="trace-slug" />);

    expect(screen.getByText('ai-conversations-0')).toBeInTheDocument();
  });

  it('uses trace-local data when conversations are unavailable', () => {
    mockGetStringAttr.mockReturnValue('conversation-1');
    mockUseAITrace.mockReturnValue({
      nodes: [{} as AITraceSpanNode],
      isLoading: false,
      error: false,
    });

    render(<TraceAiTab traceSlug="trace-slug" />);

    expect(screen.getByText('ai-conversations-0')).toBeInTheDocument();
  });
});
