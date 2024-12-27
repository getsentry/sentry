import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {EventSamples} from 'sentry/views/insights/mobile/appStarts/components/eventSamples';
import {
  MobileCursors,
  MobileSortKeys,
} from 'sentry/views/insights/mobile/screenload/constants';

jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/views/insights/common/queries/useReleases');

describe('ScreenLoadEventSamples', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  let mockEventsRequest!: jest.Mock;
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
    jest.mocked(useReleaseSelection).mockReturnValue({
      primaryRelease: 'com.example.vu.android@2.10.5',
      isLoading: false,
      secondaryRelease: 'com.example.vu.android@2.10.3+42',
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
            profile_id: 'string',
            'transaction.id': 'string',
            'span.duration': 'duration',
            'project.name': 'string',
            id: 'string',
          },
        },
        data: [
          {
            profile_id: 'profile-id',
            'transaction.id': '76af98a3ac9d4448b894e44b1819970e',
            'span.duration': 131,
            'project.name': 'sentry-cocoa',
            id: 'f0587aad3de14aeb',
          },
        ],
      },
    });
  });

  it('makes a request for the release and transaction passed as props', async function () {
    render(
      <EventSamples
        release="com.example.vu.android@2.10.5"
        sortKey={MobileSortKeys.RELEASE_1_EVENT_SAMPLE_TABLE}
        cursorName={MobileCursors.RELEASE_1_EVENT_SAMPLE_TABLE}
        transaction="ErrorController"
        showDeviceClassSelector
      />
    );

    // Check that headers are set properly
    expect(screen.getByRole('columnheader', {name: 'Event ID (R1)'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Profile'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Duration'})).toBeInTheDocument();

    expect(mockEventsRequest).toHaveBeenCalledTimes(1);

    // Check data is rendered properly
    // Transaction is a link
    expect(await screen.findByRole('link', {name: '76af98a3'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/sentry-cocoa:76af98a3ac9d4448b894e44b1819970e/'
    );

    // Profile is a button
    expect(screen.getByRole('button', {name: 'View Profile'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/profiling/profile/sentry-cocoa/profile-id/flamegraph/'
    );

    expect(screen.getByText('131.00ms')).toBeInTheDocument();
  });
});
