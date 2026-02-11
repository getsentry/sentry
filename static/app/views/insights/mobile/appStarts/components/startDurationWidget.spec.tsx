import type {Location} from 'history';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {useLocation} from 'sentry/utils/useLocation';

import StartDurationWidget from './startDurationWidget';

jest.mock('sentry/components/pageFilters/usePageFilters');
jest.mock('sentry/utils/useLocation');

describe('StartDurationWidget', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  beforeEach(() => {
    jest.mocked(usePageFilters).mockReturnValue(
      PageFilterStateFixture({
        selection: {
          datetime: {
            period: '10d',
            start: null,
            end: null,
            utc: false,
          },
          environments: [],
          projects: [parseInt(project.id, 10)],
        },
      })
    );
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [
        {
          id: 970136705,
          version: 'com.example.vu.android@2.10.5',
          dateCreated: '2023-12-19T21:37:53.895495Z',
        },
        {
          id: 969902997,
          version: 'com.example.vu.android@2.10.3+42',
          dateCreated: '2023-12-19T18:04:06.953025Z',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {
        data: {},
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [],
      },
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders correct title for cold start duration', async () => {
    jest.mocked(useLocation).mockReturnValue({
      ...LocationFixture(),
      query: {
        app_start_type: 'cold',
      },
    } as Location);

    render(<StartDurationWidget />);
    expect(await screen.findByText('Average Cold Start')).toBeInTheDocument();
  });

  it('renders correct title for warm start duration', async () => {
    jest.mocked(useLocation).mockReturnValue({
      ...LocationFixture(),
      query: {
        app_start_type: 'warm',
      },
    } as Location);

    render(<StartDurationWidget />);
    expect(await screen.findByText('Average Warm Start')).toBeInTheDocument();
  });
});
