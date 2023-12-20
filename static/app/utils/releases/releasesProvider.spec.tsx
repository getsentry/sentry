import {Release as ReleaseFixture} from 'sentry-fixture/release';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFilters} from 'sentry/types';
import {ReleasesProvider, useReleases} from 'sentry/utils/releases/releasesProvider';

function TestComponent({other}: {other: string}) {
  const {releases, loading} = useReleases();
  return (
    <div>
      <span>{other}</span>
      {releases &&
        releases.map(release => <em key={release.version}>{release.version}</em>)}
      {`loading: ${loading}`}
    </div>
  );
}

describe('useReleases', function () {
  const {organization} = initializeOrg();
  const selection = {
    projects: [1],
    environments: ['prod'],
    datetime: {
      period: '14d',
      start: null,
      end: null,
      utc: false,
    },
  } as PageFilters;

  it("fetches releases and save values in the context's state", async function () {
    const mockReleases = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [
        ReleaseFixture({
          shortVersion: 'sentry-android-shop@1.2.0',
          version: 'sentry-android-shop@1.2.0',
        }),
        ReleaseFixture({
          shortVersion: 'sentry-android-shop@1.3.0',
          version: 'sentry-android-shop@1.3.0',
        }),
        ReleaseFixture({
          shortVersion: 'sentry-android-shop@1.4.0',
          version: 'sentry-android-shop@1.4.0',
        }),
      ],
    });

    render(
      <ReleasesProvider organization={organization} selection={selection}>
        <TestComponent other="value" />
      </ReleasesProvider>
    );

    // Should forward prop
    expect(screen.getByText('value')).toBeInTheDocument();

    expect(mockReleases).toHaveBeenCalledTimes(1);

    expect(await screen.findByText('loading: false')).toBeInTheDocument();
    expect(screen.getByText('sentry-android-shop@1.2.0')).toBeInTheDocument();
    expect(screen.getByText('sentry-android-shop@1.3.0')).toBeInTheDocument();
  });
});
