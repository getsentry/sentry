import {render, screen} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';
import {useAITrace} from 'sentry/views/insights/pages/agents/hooks/useAITrace';
import {getStringAttr} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {TraceAiTab} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceAiTab';

jest.mock('sentry/utils/analytics');
jest.mock('sentry/views/insights/pages/agents/hooks/useAITrace');
jest.mock('sentry/views/insights/pages/agents/utils/aiTraceNodes');
jest.mock(
  'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceAiSpans',
  () => ({TraceAiSpans: () => <div>ai-spans</div>})
);
jest.mock(
  'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceAiConversations',
  () => ({TraceAiConversations: () => <div>ai-conversations</div>})
);

const mockUseAITrace = jest.mocked(useAITrace);
const mockGetStringAttr = jest.mocked(getStringAttr);
const mockTrackAnalytics = jest.mocked(trackAnalytics);

describe('TraceAiTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStringAttr.mockReturnValue(undefined);
  });

  it('fires trace.rendered exactly once across the loading -> conversations swap', () => {
    mockUseAITrace.mockReturnValue({nodes: [], isLoading: true, error: false});
    const {rerender} = render(<TraceAiTab traceSlug="trace-slug" />);
    expect(mockTrackAnalytics).not.toHaveBeenCalled();

    mockGetStringAttr.mockReturnValue('conversation-1');
    mockUseAITrace.mockReturnValue({
      nodes: [{} as AITraceSpanNode],
      isLoading: false,
      error: false,
    });
    rerender(<TraceAiTab traceSlug="trace-slug" />);

    expect(screen.getByText('ai-conversations')).toBeInTheDocument();
    expect(mockTrackAnalytics).toHaveBeenCalledTimes(1);
    expect(mockTrackAnalytics).toHaveBeenCalledWith(
      'agent-monitoring.trace.rendered',
      expect.anything()
    );

    rerender(<TraceAiTab traceSlug="trace-slug" />);
    expect(mockTrackAnalytics).toHaveBeenCalledTimes(1);
  });
});
