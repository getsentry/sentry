import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import WebVitalsLandingPage from 'sentry/views/insights/browser/webVitals/views/webVitalsLandingPage';

describe('WebVitalsLandingPage', () => {
  const organization = OrganizationFixture({
    features: ['insight-modules'],
  });

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/insights/frontend/pageloads/`,
      query: {},
    },
    route: `/organizations/:orgId/insights/frontend/pageloads/`,
  };

  let eventsMock: jest.Mock;

  beforeEach(() => {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {period: '14d', start: null, end: null, utc: null},
    });

    ProjectsStore.loadInitialData([
      ProjectFixture({hasInsightsVitals: true, firstTransactionEvent: true}),
    ]);

    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: 'performance_score(measurements.score.lcp)',
            values: [
              {
                timestamp: 1743348600000,
                value: 0.6106921965623204,
              },
            ],
          }),
          TimeSeriesFixture({
            yAxis: 'performance_score(measurements.score.fcp)',
            values: [
              {
                timestamp: 1743348600000,
                value: 0.7397871866098699,
              },
            ],
          }),
        ],
      },
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders', async () => {
    render(<WebVitalsLandingPage />, {
      organization,
      initialRouterConfig,
    });
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
    // geo subregion query
    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'spans',
          field: ['user.geo.subregion', 'count()'],
          query: 'has:user.geo.subregion',
        }),
      })
    );
    // Table query
    expect(eventsMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'spans',
          field: [
            'project.id',
            'project',
            'transaction',
            'p75(measurements.lcp)',
            'p75(measurements.fcp)',
            'p75(measurements.cls)',
            'p75(measurements.ttfb)',
            'p75(measurements.inp)',
            'opportunity_score(measurements.score.total)',
            'performance_score(measurements.score.total)',
            'count()',
            'count_scores(measurements.score.lcp)',
            'count_scores(measurements.score.fcp)',
            'count_scores(measurements.score.cls)',
            'count_scores(measurements.score.inp)',
            'count_scores(measurements.score.ttfb)',
            'count_scores(measurements.score.total)',
          ],
          query:
            'span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,ui.webvital.lcp,pageload,""] avg(measurements.score.total):>=0',
        }),
      })
    );
    // Raw web vital metric tile queries
    expect(eventsMock).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'spans',
          field: [
            'p75(measurements.lcp)',
            'p75(measurements.fcp)',
            'p75(measurements.cls)',
            'p75(measurements.ttfb)',
            'p75(measurements.inp)',
            'count()',
          ],
          query:
            'span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,ui.webvital.lcp,pageload,""]',
        }),
      })
    );
    // Project performance score ring query
    expect(eventsMock).toHaveBeenNthCalledWith(
      4,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'spans',
          field: [
            'performance_score(measurements.score.lcp)',
            'performance_score(measurements.score.fcp)',
            'performance_score(measurements.score.cls)',
            `performance_score(measurements.score.inp)`,
            'performance_score(measurements.score.ttfb)',
            'performance_score(measurements.score.total)',
            'avg(measurements.score.weight.lcp)',
            'avg(measurements.score.weight.fcp)',
            'avg(measurements.score.weight.cls)',
            `avg(measurements.score.weight.inp)`,
            'avg(measurements.score.weight.ttfb)',
            'count()',
            'count_scores(measurements.score.total)',
            'count_scores(measurements.score.lcp)',
            'count_scores(measurements.score.fcp)',
            'count_scores(measurements.score.cls)',
            'count_scores(measurements.score.ttfb)',
            `count_scores(measurements.score.inp)`,
          ],
          query:
            'span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,ui.webvital.lcp,pageload,""]',
        }),
      })
    );
  });
});
