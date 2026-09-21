import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReleaseFixture} from 'sentry-fixture/release';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SdkVersions} from './sdkVersions';

describe('SdkVersions', () => {
  const organization = OrganizationFixture();

  it('renders each SDK version with its share of events when the release has events', async () => {
    const release = ReleaseFixture({
      firstEvent: '2020-03-23T01:02:30Z',
      lastEvent: '2020-03-24T02:04:50Z',
    });
    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [
          {'sdk.name': 'sentry.java.android', 'sdk.version': '8.1.0', 'count()': 75},
          {'sdk.name': 'sentry.native.android', 'sdk.version': '0.8.0', 'count()': 25},
        ],
      },
    });

    render(<SdkVersions orgSlug={organization.slug} projectId="1" release={release} />, {
      organization,
    });

    expect(await screen.findByText('sentry.java.android')).toBeInTheDocument();
    expect(screen.getByText('8.1.0')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('sentry.native.android')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(eventsRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'has:sdk.version release:sentry-android-shop@1.2.0',
          start: '2020-03-23T01:02:30Z',
          end: '2020-03-24T02:04:51.000Z',
        }),
      })
    );
  });

  it('renders nothing when the release has no events', () => {
    const release = ReleaseFixture({firstEvent: '', lastEvent: ''});
    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });

    const {container} = render(
      <SdkVersions orgSlug={organization.slug} projectId="1" release={release} />,
      {organization}
    );

    expect(container).toBeEmptyDOMElement();
    expect(eventsRequest).not.toHaveBeenCalled();
  });
});
