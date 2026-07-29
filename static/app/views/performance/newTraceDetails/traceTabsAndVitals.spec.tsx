import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {TraceTabsAndVitals} from 'sentry/views/performance/newTraceDetails/traceTabsAndVitals';
import {
  TraceLayoutTabKeys,
  type TraceLayoutTabsConfig,
} from 'sentry/views/performance/newTraceDetails/useTraceLayoutTabs';

describe('TraceTabsAndVitals', () => {
  it('renders tabs while optional root event details are loading', () => {
    const tabsConfig: TraceLayoutTabsConfig = {
      currentTab: TraceLayoutTabKeys.WATERFALL,
      isLoading: false,
      onTabChange: jest.fn(),
      tabOptions: [
        {
          label: 'Waterfall',
          slug: TraceLayoutTabKeys.WATERFALL,
        },
      ],
    };
    const rootEventResults = {
      data: undefined,
      isLoading: true,
      status: 'pending',
    } as TraceRootEventQueryResults;

    render(
      <TraceTabsAndVitals
        tabsConfig={tabsConfig}
        rootEventResults={rootEventResults}
        tree={new TraceTree().build()}
      />
    );

    expect(screen.getByRole('tab', {name: 'Waterfall'})).toBeInTheDocument();
  });
});
