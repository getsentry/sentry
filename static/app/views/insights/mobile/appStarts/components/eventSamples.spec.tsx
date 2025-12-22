import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import {EventSamples} from 'sentry/views/insights/mobile/appStarts/components/eventSamples';
import {
  MobileCursors,
  MobileSortKeys,
} from 'sentry/views/insights/mobile/screenload/constants';

jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/views/insights/common/queries/useReleases');

describe('ScreenLoadEventSamples', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  let mockEventsRequest!: jest.Mock;
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
      ],
    });
    mockEventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        meta: {
          fields: {
            profile_id: 'string',
            'transaction.span_id': 'string',
            'span.duration': 'duration',
            project: 'string',
            id: 'string',
          },
        },
        data: [
          {
            profile_id: 'profile-id',
            'transaction.span_id': '76af98a3ac9d4448b894e44b1819970e',
            'span.duration': 131,
            project: 'sentry-cocoa',
            id: 'f0587aad3de14aeb',
            trace: 'trace-id',
          },
        ],
      },
      match: [
        MockApiClient.matchQuery({referrer: 'api.insights.mobile-startup-event-samples'}),
      ],
    });
  });

  it('makes a request without release filter when release is empty string', async () => {
    render(
      <EventSamples
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
      <EventSamples
        release="com.example.vu.android@2.10.5"
        sortKey={MobileSortKeys.RELEASE_1_EVENT_SAMPLE_TABLE}
        cursorName={MobileCursors.RELEASE_1_EVENT_SAMPLE_TABLE}
        transaction="ErrorController"
      />
    );

    // Check that headers are set properly
    expect(screen.getByRole('columnheader', {name: 'Event ID'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Profile'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Duration'})).toBeInTheDocument();

    expect(mockEventsRequest).toHaveBeenCalledTimes(1);

    // Check data is rendered properly
    // Transaction is a link
    expect(await screen.findByRole('link', {name: '76af98a3'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/traces/trace/trace-id/?statsPeriod=14d'
    );

    // Profile is a button
    expect(screen.getByRole('button', {name: 'View Profile'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/profiling/profile/sentry-cocoa/profile-id/flamegraph/'
    );

    expect(screen.getByText('131.00ms')).toBeInTheDocument();
  });
});
