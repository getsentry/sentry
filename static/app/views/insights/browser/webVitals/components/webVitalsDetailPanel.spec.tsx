import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {WebVitalsDetailPanel} from 'sentry/views/insights/browser/webVitals/components/webVitalsDetailPanel';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('WebVitalsDetailPanel', function () {
  const organization = OrganizationFixture();
  let eventsMock: jest.Mock;
  let eventsStatsMock: jest.Mock;

  beforeEach(function () {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {},
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
    jest.mocked(usePageFilters).mockReturnValue({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        datetime: {
          period: '10d',
          start: null,
          end: null,
          utc: false,
        },
        environments: [],
        projects: [],
      },
    });

    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [],
      },
    });
    eventsStatsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {},
    });
  });

  afterEach(function () {
    jest.resetAllMocks();
  });

  it('renders correctly with empty results', async () => {
    render(<WebVitalsDetailPanel onClose={() => undefined} webVital="lcp" />, {
      organization,
    });
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    // Raw web vital metric tile queries
    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
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
            'p75(transaction.duration)',
            'count_web_vitals(measurements.lcp, any)',
            'count_web_vitals(measurements.fcp, any)',
            'count_web_vitals(measurements.cls, any)',
            'count_web_vitals(measurements.ttfb, any)',
            'count_web_vitals(measurements.inp, any)',
            'count()',
          ],
          query:
            'transaction.op:[pageload,""] span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,""] !transaction:"<< unparameterized >>"',
        }),
      })
    );
    // Project performance score ring query
    expect(eventsMock).toHaveBeenNthCalledWith(
      2,
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
            'count_scores(measurements.score.inp)',
            'sum(measurements.score.weight.lcp)',
          ],
          query:
            'transaction.op:[pageload,""] span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,""] !transaction:"<< unparameterized >>"',
        }),
      })
    );
    // Table query
    expect(eventsMock).toHaveBeenNthCalledWith(
      3,
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
            'performance_score(measurements.score.lcp)',
            'opportunity_score(measurements.score.lcp)',
            'performance_score(measurements.score.total)',
            'count()',
            'count_scores(measurements.score.lcp)',
            'count_scores(measurements.score.fcp)',
            'count_scores(measurements.score.cls)',
            'count_scores(measurements.score.inp)',
            'count_scores(measurements.score.ttfb)',
            'total_opportunity_score()',
          ],
          query:
            'transaction.op:[pageload,""] span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,""] !transaction:"<< unparameterized >>" avg(measurements.score.total):>=0 count_scores(measurements.score.lcp):>0',
        }),
      })
    );
    expect(eventsStatsMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Largest Contentful Paint (P75)')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(
      screen.getByText(/Largest Contentful Paint \(LCP\) measures the render/)
    ).toBeInTheDocument();
  });
});
