import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import WebVitalsLandingPage from 'sentry/views/insights/browser/webVitals/views/webVitalsLandingPage';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('WebVitalsLandingPage', function () {
  const organization = OrganizationFixture({
    features: ['insights-initial-modules'],
  });

  let eventsMock: jest.Mock;

  beforeEach(function () {
    ProjectsStore.loadInitialData([
      ProjectFixture({hasInsightsVitals: true, firstTransactionEvent: true}),
    ]);

    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {},
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });

    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());

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
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {
        'performance_score(measurements.score.lcp)': {
          data: [[1743348600, [{count: 0.6106921965623204}]]],
        },
        'performance_score(measurements.score.fcp)': {
          data: [[1743435000, [{count: 0.7397871866098699}]]],
        },
      },
    });
  });

  afterEach(function () {
    jest.resetAllMocks();
  });

  it('renders', async () => {
    render(<WebVitalsLandingPage />, {organization, deprecatedRouterMocks: true});
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
    // Table query
    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'metrics',
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
            'total_opportunity_score()',
          ],
          query:
            'transaction.op:[pageload,""] span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,ui.webvital.lcp,""] !transaction:"<< unparameterized >>" avg(measurements.score.total):>=0',
        }),
      })
    );
    // Raw web vital metric tile queries
    expect(eventsMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'metrics',
          field: [
            'p75(measurements.lcp)',
            'p75(measurements.fcp)',
            'p75(measurements.cls)',
            'p75(measurements.ttfb)',
            'p75(measurements.inp)',
            'count()',
          ],
          query:
            'transaction.op:[pageload,""] span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,ui.webvital.lcp,""] !transaction:"<< unparameterized >>"',
        }),
      })
    );
    // Project performance score ring query
    expect(eventsMock).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'metrics',
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
            'transaction.op:[pageload,""] span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,ui.webvital.lcp,""] !transaction:"<< unparameterized >>"',
        }),
      })
    );
  });
});
