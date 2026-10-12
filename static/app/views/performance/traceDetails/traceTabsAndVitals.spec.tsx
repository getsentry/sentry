import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import type {TraceRootEventQueryResults} from 'sentry/views/performance/traceDetails/traceApi/useTraceRootEvent';
import {TraceContextVitals} from 'sentry/views/performance/traceDetails/traceContextVitals';
import {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import {
  makeEAPSpan,
  makeEAPTrace,
} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';
import {TraceTabsAndVitals} from 'sentry/views/performance/traceDetails/traceTabsAndVitals';
import {
  TraceLayoutTabKeys,
  type TraceLayoutTabsConfig,
} from 'sentry/views/performance/traceDetails/useTraceLayoutTabs';

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
      makeEAPTrace([
        makeEAPSpan({
          event_id: 'root-transaction',
          measurements: {'measurements.lcp': 500},
          parent_span_id: null,
          project_id: 1,
          project_slug: 'project-slug',
        }),
      ]),
      {organization, replay: null}
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
