import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import PageOverview from 'sentry/views/performance/browser/webVitals/pageOverview';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

describe('PageOverview', function () {
  const organization = OrganizationFixture({
    features: ['starfish-browser-webvitals', 'performance-database-view'],
  });

  let eventsMock;

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
    jest.mocked(useOrganization).mockReturnValue(organization);

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
      body: {},
    });
  });

  afterEach(function () {
    jest.clearAllMocks();
  });

  it('renders performance score migration alert', async () => {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {useStoredScores: 'true', transaction: '/'},
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
    render(<PageOverview />);
    await screen.findByText(
      /We made improvements to how Performance Scores are calculated for your projects/
    );
  });

  it('renders pageload and interaction switcher', async () => {
    const organizationWithInp = OrganizationFixture({
      features: [
        'starfish-browser-webvitals',
        'performance-database-view',
        'starfish-browser-webvitals-replace-fid-with-inp',
      ],
    });
    jest.mocked(useOrganization).mockReturnValue(organizationWithInp);
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {useStoredScores: 'true', transaction: '/'},
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
    render(<PageOverview />);
    await screen.findAllByText('Interactions');
    await userEvent.click(screen.getAllByText('Interactions')[0]);
    await waitFor(() =>
      expect(eventsMock).toHaveBeenLastCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'spansIndexed',
            field: [
              'measurements.inp',
              'measurements.score.inp',
              'measurements.score.weight.inp',
              'measurements.score.total',
              'span_id',
              'timestamp',
              'profile_id',
              'replay.id',
              'user',
              'origin.transaction',
              'project',
              'browser.name',
              'span.self_time',
            ],
            query:
              'span.op:ui.interaction.click measurements.score.weight.inp:>0 origin.transaction:/',
          }),
        })
      )
    );
  });
});
