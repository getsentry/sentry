import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import PageOverview from 'sentry/views/insights/browser/webVitals/views/pageOverview';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('PageOverview', function () {
  const organization = OrganizationFixture({
    features: ['insights-initial-modules'],
  });

  let eventsMock: jest.Mock;

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
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans-aggregation/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/tags/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      body: [],
    });
  });

  afterEach(function () {
    jest.clearAllMocks();
  });

  it('renders', () => {
    render(<PageOverview />, {organization});
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
            `count_scores(measurements.score.inp)`,
          ],
          query:
            'transaction.op:[pageload,""] span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,""] !transaction:"<< unparameterized >>"',
        }),
      })
    );
  });

  it('renders interaction samples', async () => {
    const organizationWithInp = OrganizationFixture({
      features: ['insights-initial-modules'],
    });
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {transaction: '/', type: 'interactions'},
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
    render(<PageOverview />, {organization: organizationWithInp});
    await waitFor(() =>
      expect(eventsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spansIndexed',
            field: [
              'measurements.inp',
              'measurements.lcp',
              'measurements.cls',
              'measurements.score.inp',
              'measurements.score.lcp',
              'measurements.score.cls',
              'measurements.score.total',
              'trace',
              'profile_id',
              'replay',
              'user.display',
              'project',
              'span.description',
              'timestamp',
              'span.self_time',
              'transaction',
            ],
            query:
              'has:message !span.description:<unknown> transaction:/  span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press]',
          }),
        })
      )
    );
  });

  it('escapes transaction name before querying discover', async () => {
    const organizationWithInp = OrganizationFixture({
      features: ['insights-initial-modules'],
    });
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {
        transaction: '/page-with-a-*/',
        type: 'interactions',
      },
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
    render(<PageOverview />, {organization: organizationWithInp});
    await waitFor(() =>
      expect(eventsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spansIndexed',
            field: [
              'measurements.inp',
              'measurements.lcp',
              'measurements.cls',
              'measurements.score.inp',
              'measurements.score.lcp',
              'measurements.score.cls',
              'measurements.score.total',
              'trace',
              'profile_id',
              'replay',
              'user.display',
              'project',
              'span.description',
              'timestamp',
              'span.self_time',
              'transaction',
            ],
            query:
              'has:message !span.description:<unknown> transaction:"/page-with-a-\\*/"  span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press]',
          }),
        })
      )
    );
  });
});
