import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {ScreenLoadEventSamples} from 'sentry/views/insights/mobile/screenload/components/eventSamples';
import {
  MobileCursors,
  MobileSortKeys,
} from 'sentry/views/insights/mobile/screenload/constants';

jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/views/insights/common/queries/useReleases');

describe('ScreenLoadEventSamples', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  let mockEventsRequest: jest.Mock;
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
    jest.mocked(useReleaseSelection).mockReturnValue({
      primaryRelease: 'com.example.vu.android@2.10.5',
      isLoading: false,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.insights.user-geo-subregion-selector',
        }),
      ],
      body: {
        data: [
          {'user.geo.subregion': '21', 'count()': 123},
          {'user.geo.subregion': '155', 'count()': 123},
        ],
        meta: {
          fields: {'user.geo.subregion': 'string', 'count()': 'integer'},
        },
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
    mockEventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        meta: {
          fields: {
            id: 'string',
            project: 'string',
            'profile.id': 'string',
            'measurements.time_to_initial_display': 'duration',
            'measurements.time_to_full_display': 'duration',
          },
        },
        data: [
          {
            id: '4142de70494989c04f023ce1727ac856f31b7f92',
            project: 'project1',
            'profile.id': 'profile1',
            'measurements.time_to_initial_display': 100.0,
            'measurements.time_to_full_display': 200.0,
            trace: 'trace-id',
          },
        ],
      },
      match: [MockApiClient.matchQuery({referrer: 'api.insights.mobile-event-samples'})],
    });
  });

  it('makes a request without release filter when release is empty string', async () => {
    render(
      <ScreenLoadEventSamples
        release=""
        sortKey={MobileSortKeys.RELEASE_1_EVENT_SAMPLE_TABLE}
        cursorName={MobileCursors.RELEASE_1_EVENT_SAMPLE_TABLE}
        transaction="ErrorController"
      />
    );

    await waitFor(() => {
      expect(mockEventsRequest).toHaveBeenCalledTimes(1);
    });

    // Check that the request query does not include a release filter
    const requestCall = mockEventsRequest.mock.calls[0];
    expect(requestCall[1].query.query).not.toContain('release:');
  });

  it('makes a request for the release and transaction passed as props', async () => {
    render(
      <ScreenLoadEventSamples
        release="com.example.vu.android@2.10.5"
        sortKey={MobileSortKeys.RELEASE_1_EVENT_SAMPLE_TABLE}
        cursorName={MobileCursors.RELEASE_1_EVENT_SAMPLE_TABLE}
        transaction="ErrorController"
      />
    );

    // Check that headers are set properly
    expect(screen.getByRole('columnheader', {name: 'Event ID'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Profile'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'TTID'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'TTFD'})).toBeInTheDocument();

    expect(mockEventsRequest).toHaveBeenCalledTimes(1);

    // Check data is rendered properly
    // Transaction is a link
    expect(await screen.findByRole('link', {name: '4142de70'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/traces/trace/trace-id/?statsPeriod=14d'
    );

    // Profile is a button
    expect(screen.getByRole('button', {name: 'View Profile'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/profiling/profile/project1/profile1/flamegraph/'
    );

    // TTID is a duration
    expect(screen.getByText('100.00ms')).toBeInTheDocument();

    // TTFD is a duration
    expect(screen.getByText('200.00ms')).toBeInTheDocument();
  });
});
