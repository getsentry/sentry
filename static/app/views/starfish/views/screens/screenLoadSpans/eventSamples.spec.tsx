import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import {
  MobileCursors,
  MobileSortKeys,
} from 'sentry/views/starfish/views/screens/constants';
import {ScreenLoadEventSamples} from 'sentry/views/starfish/views/screens/screenLoadSpans/eventSamples';

jest.mock('sentry/utils/usePageFilters');

describe('ScreenLoadEventSamples', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  let mockEventsRequest;
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
    mockEventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        meta: {
          fields: {
            id: 'string',
            'project.name': 'string',
            'profile.id': 'string',
            'measurements.time_to_initial_display': 'duration',
            'measurements.time_to_full_display': 'duration',
          },
        },
        data: [
          {
            id: '4142de70494989c04f023ce1727ac856f31b7f92',
            'project.name': 'project1',
            'profile.id': 'profile1',
            'measurements.time_to_initial_display': 100.0,
            'measurements.time_to_full_display': 200.0,
          },
        ],
      },
    });
  });

  it('makes a request for the release and transaction passed as props', async function () {
    render(
      <ScreenLoadEventSamples
        release="com.example.vu.android@2.10.5"
        sortKey={MobileSortKeys.RELEASE_1_EVENT_SAMPLE_TABLE}
        cursorName={MobileCursors.RELEASE_1_EVENT_SAMPLE_TABLE}
        transaction="ErrorController"
        showDeviceClassSelector
      />
    );

    // Check that headers are set properly
    expect(
      screen.getByRole('columnheader', {name: 'Event ID (2.10.5)'})
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Profile'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'TTID'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'TTFD'})).toBeInTheDocument();

    expect(mockEventsRequest).toHaveBeenCalledTimes(1);

    // Check data is rendered properly
    // Transaction is a link
    expect(await screen.findByRole('link', {name: '4142de70'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/project1:4142de70494989c04f023ce1727ac856f31b7f92'
    );

    // Profile is a button
    expect(screen.getByRole('button', {name: 'View Profile'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/profiling/profile/project1/profile1/flamegraph/'
    );

    // TTID is a duration
    expect(screen.getByText('100.00ms')).toBeInTheDocument();

    // TTFD is a duration
    expect(screen.getByText('200.00ms')).toBeInTheDocument();
  });
});
