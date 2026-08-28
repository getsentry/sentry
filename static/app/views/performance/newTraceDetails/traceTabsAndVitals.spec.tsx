import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {TraceContextVitals} from 'sentry/views/performance/newTraceDetails/traceContextVitals';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {
  makeTrace,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {TraceTabsAndVitals} from 'sentry/views/performance/newTraceDetails/traceTabsAndVitals';
import {
  TraceLayoutTabKeys,
  type TraceLayoutTabsConfig,
} from 'sentry/views/performance/newTraceDetails/useTraceLayoutTabs';

describe('TraceTabsAndVitals', () => {
  afterEach(() => {
    setWindowLocation('http://localhost/');
  });

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

  it('uses the router location when navigating from a vital pill', async () => {
    const organization = OrganizationFixture();
    const tree = TraceTree.FromTrace(
      makeTrace({
        transactions: [
          makeTransaction({
            event_id: 'root-transaction',
            measurements: {lcp: {value: 500, unit: 'millisecond'}},
            parent_span_id: null,
            project_id: 1,
            project_slug: 'project-slug',
          }),
        ],
      }),
      {meta: null, organization, replay: null}
    );
    const rootEventResults = {data: {}} as TraceRootEventQueryResults;

    setWindowLocation('http://localhost/browser-path/?browser=ignored');
    const {router} = render(
      <TraceContextVitals rootEventResults={rootEventResults} tree={tree} />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/router-path/',
            query: {existing: 'preserved'},
          },
        },
      }
    );

    await userEvent.click(screen.getByRole('button', {name: /LCP/}));

    expect(router.location.pathname).toBe('/router-path/');
    expect(router.location.query).toEqual(
      expect.objectContaining({existing: 'preserved', tab: 'waterfall'})
    );
    expect(router.location.query.browser).toBeUndefined();
  });
});
