import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {PageFilters} from 'sentry/types/core';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import PageOverview from 'sentry/views/insights/browser/webVitals/views/pageOverview';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('PageOverview', () => {
  const organization = OrganizationFixture({
    features: ['insight-modules'],
  });

  let eventsMock: jest.Mock;

  beforeEach(() => {
    const pageFilters: PageFilters = {
      projects: [1],
      environments: [],
      datetime: {
        period: '14d',
        start: null,
        end: null,
        utc: null,
      },
    };
    PageFiltersStore.onInitializeUrlState(pageFilters, new Set());
    const project = ProjectFixture({id: '1', slug: 'project-slug'});
    ProjectsStore.loadInitialData([project]);

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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/seer/preferences/',
      method: 'GET',
      body: {},
    });
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
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
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders', () => {
    render(<PageOverview />, {organization, deprecatedRouterMocks: true});
    // Raw web vital metric tile queries
    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
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
            'span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,ui.webvital.lcp,pageload,""] !transaction:"<< unparameterized >>"',
        }),
      })
    );
    // Project performance score ring query
    expect(eventsMock).toHaveBeenNthCalledWith(
      2,
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
            'span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press,ui.webvital.cls,ui.webvital.lcp,pageload,""] !transaction:"<< unparameterized >>"',
        }),
      })
    );
  });

  it('renders interaction samples', async () => {
    const organizationWithInp = OrganizationFixture({
      features: ['insight-modules'],
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
    render(<PageOverview />, {
      organization: organizationWithInp,
      deprecatedRouterMocks: true,
    });
    await waitFor(() =>
      expect(eventsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spans',
            sampling: SAMPLING_MODE.NORMAL,
            field: [
              'measurements.inp',
              'measurements.score.ratio.inp',
              'measurements.score.total',
              'trace',
              'profile_id',
              'profile.id',
              'replay.id',
              'replayId',
              'user.email',
              'user.username',
              'user.id',
              'user.ip',
              'project',
              'span.description',
              'timestamp',
              'span.self_time',
              'transaction',
              'span.op',
              'lcp.element',
              'cls.source.1',
              'id',
            ],
            query:
              'has:message !span.description:<unknown> transaction:/  span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press] ',
          }),
        })
      )
    );
  });

  it('escapes transaction name before querying discover', async () => {
    const organizationWithInp = OrganizationFixture({
      features: ['insight-modules'],
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
    render(<PageOverview />, {
      organization: organizationWithInp,
      deprecatedRouterMocks: true,
    });
    await waitFor(() =>
      expect(eventsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spans',
            sampling: SAMPLING_MODE.NORMAL,
            field: [
              'measurements.inp',
              'measurements.score.ratio.inp',
              'measurements.score.total',
              'trace',
              'profile_id',
              'profile.id',
              'replay.id',
              'replayId',
              'user.email',
              'user.username',
              'user.id',
              'user.ip',
              'project',
              'span.description',
              'timestamp',
              'span.self_time',
              'transaction',
              'span.op',
              'lcp.element',
              'cls.source.1',
              'id',
            ],
            query:
              'has:message !span.description:<unknown> transaction:"/page-with-a-\\*/"  span.op:[ui.interaction.click,ui.interaction.hover,ui.interaction.drag,ui.interaction.press] ',
          }),
        })
      )
    );
  });
});
