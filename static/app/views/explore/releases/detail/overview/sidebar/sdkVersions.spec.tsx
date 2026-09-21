import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReleaseFixture} from 'sentry-fixture/release';
import {ReleaseMetaFixture} from 'sentry-fixture/releaseMeta';
import {ReleaseProjectFixture} from 'sentry-fixture/releaseProject';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ReleaseProject} from 'sentry/types/release';
import {ReleaseContext} from 'sentry/views/explore/releases/detail';
import {getReleaseBounds} from 'sentry/views/explore/releases/utils';

import {SdkVersions} from './sdkVersions';

describe('SdkVersions', () => {
  const organization = OrganizationFixture();
  const release = ReleaseFixture({
    dateCreated: '2020-03-23T01:02:30Z',
    lastEvent: '2020-03-24T02:04:50Z',
  });
  const releaseBounds = getReleaseBounds(release);

  function renderSdkVersions() {
    return render(
      <ReleaseContext
        value={{
          release,
          project: ReleaseProjectFixture() as Required<ReleaseProject>,
          deploys: [],
          refetchData: () => {},
          hasHealthData: false,
          releaseBounds,
          releaseMeta: ReleaseMetaFixture(),
        }}
      >
        <SdkVersions organization={organization} version={release.version} />
      </ReleaseContext>,
      {organization}
    );
  }

  it('renders each SDK version with its share of events when the release has events', async () => {
    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {
            'project.id': 1,
            release: release.version,
            'sdk.name': 'sentry.java.android',
            'sdk.version': '8.1.0',
            'count()': 75,
          },
          {
            'project.id': 1,
            release: release.version,
            'sdk.name': 'sentry.native.android',
            'sdk.version': '0.8.0',
            'count()': 25,
          },
        ],
      },
    });

    renderSdkVersions();

    expect(await screen.findByText('sentry.java.android')).toBeInTheDocument();
    expect(screen.getByText('8.1.0')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('sentry.native.android')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(eventsRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'has:sdk.version ( release:sentry-android-shop@1.2.0 )',
          start: releaseBounds.releaseStart,
          end: releaseBounds.releaseEnd,
        }),
      })
    );
  });

  it('renders nothing when the release has no SDK versions', async () => {
    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });

    const {container} = renderSdkVersions();

    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(eventsRequest).toHaveBeenCalled();
  });
});
