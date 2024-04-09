import type {Location} from 'history';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {MultiSeriesEventsStats} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  PRIMARY_RELEASE_COLOR,
  SECONDARY_RELEASE_COLOR,
} from 'sentry/views/starfish/colours';

import StartDurationWidget, {transformData} from './startDurationWidget';

jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useLocation');

describe('StartDurationWidget', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  beforeEach(function () {
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
        projects: [parseInt(project.id, 10)],
      },
    });
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

  afterEach(function () {
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

    render(<StartDurationWidget chartHeight={200} />);
    expect(await screen.findByText('Average Cold Start')).toBeInTheDocument();
  });

  it('renders correct title for warm start duration', async () => {
    jest.mocked(useLocation).mockReturnValue({
      ...LocationFixture(),
      query: {
        app_start_type: 'warm',
      },
    } as Location);

    render(<StartDurationWidget chartHeight={200} />);
    expect(await screen.findByText('Average Warm Start')).toBeInTheDocument();
  });

  describe('transformData', () => {
    it('properly sets the release color and transforms timestamps', () => {
      const mockData = {
        'com.example.vu.android@2.10.5': {
          data: [
            [
              1703937600,
              [
                {
                  count: 100,
                },
              ],
            ],
          ],
          order: 0,
          isMetricsData: false,
          start: 1703937600,
          end: 1706529600,
          meta: {
            fields: {},
            units: {},
            isMetricsData: false,
            isMetricsExtractedData: false,
            tips: {},
            datasetReason: 'unchanged',
            dataset: 'spansMetrics',
          },
        },
        'com.example.vu.android@2.10.3+42': {
          data: [
            [
              1703937600,
              [
                {
                  count: 200,
                },
              ],
            ],
          ],
          order: 1,
          isMetricsData: false,
          start: 1703937600,
          end: 1706529600,
          meta: {
            fields: {},
            units: {},
            isMetricsData: false,
            isMetricsExtractedData: false,
            tips: {},
            datasetReason: 'unchanged',
            dataset: 'spansMetrics',
          },
        },
      } as MultiSeriesEventsStats;

      // com.example.vu.android@2.10.5 is noted as the primary, so the series with
      // com.example.vu.android@2.10.3+42 should be colored differently.
      const transformedData = transformData(mockData, 'com.example.vu.android@2.10.5');
      expect(transformedData).toEqual({
        'com.example.vu.android@2.10.5': {
          seriesName: 'com.example.vu.android@2.10.5',
          color: PRIMARY_RELEASE_COLOR,
          data: [
            {
              name: 1703937600000,
              value: 100,
            },
          ],
        },
        'com.example.vu.android@2.10.3+42': {
          seriesName: 'com.example.vu.android@2.10.3+42',
          color: SECONDARY_RELEASE_COLOR,
          data: [
            {
              name: 1703937600000,
              value: 200,
            },
          ],
          lineStyle: {
            type: 'dashed',
          },
        },
      });
    });
  });
});
