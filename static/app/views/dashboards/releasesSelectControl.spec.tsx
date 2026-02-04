import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ReleaseFixture} from 'sentry-fixture/release';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ReleasesSortOption} from 'sentry/constants/releases';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {ReleasesSelectControl} from 'sentry/views/dashboards/releasesSelectControl';
import type {DashboardFilters} from 'sentry/views/dashboards/types';

function renderReleasesSelect({
  handleChangeFilter,
}: {
  handleChangeFilter?: (activeFilters: DashboardFilters) => void;
} = {}) {
  const organization = OrganizationFixture();

  // Initialize PageFiltersStore
  PageFiltersStore.init();
  PageFiltersStore.onInitializeUrlState(
    PageFiltersFixture({
      projects: [1],
      environments: ['production'],
    })
  );

  // Mock releases API
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/releases/`,
    body: [
      ReleaseFixture({
        id: '1',
        shortVersion: 'sentry-android-shop@1.2.0',
        version: 'sentry-android-shop@1.2.0',
        dateCreated: '2021-03-19T01:00:00Z',
      }),
      ReleaseFixture({
        id: '2',
        shortVersion: 'sentry-android-shop@1.3.0',
        version: 'sentry-android-shop@1.3.0',
        dateCreated: '2021-03-20T01:00:00Z',
      }),
      ReleaseFixture({
        id: '3',
        shortVersion: 'sentry-android-shop@1.4.0',
        version: 'sentry-android-shop@1.4.0',
        dateCreated: '2021-03-21T01:00:00Z',
      }),
    ],
  });

  // Mock events API for event counts
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    body: {
      data: [],
    },
  });

  render(
    <ReleasesSelectControl
      selectedReleases={[]}
      sortBy={ReleasesSortOption.DATE}
      handleChangeFilter={handleChangeFilter}
    />,
    {organization}
  );
}

describe('Dashboards > ReleasesSelectControl', () => {
  it('updates menu title with selection', async () => {
    renderReleasesSelect();

    expect(await screen.findByText('All Releases')).toBeInTheDocument();

    await userEvent.click(screen.getByText('All Releases'));
    expect(await screen.findByText('Latest Release(s)')).toBeInTheDocument();
    await userEvent.click(screen.getByText('sentry-android-shop@1.2.0'));

    await userEvent.click(document.body);

    expect(await screen.findByText('sentry-android-shop@1.2.0')).toBeInTheDocument();
    expect(screen.queryByText('+1')).not.toBeInTheDocument();
  });

  it('updates menu title with multiple selections', async () => {
    renderReleasesSelect();

    expect(await screen.findByText('All Releases')).toBeInTheDocument();

    await userEvent.click(screen.getByText('All Releases'));
    await userEvent.click(await screen.findByText('sentry-android-shop@1.2.0'));
    await userEvent.click(screen.getByText('sentry-android-shop@1.4.0'));

    await userEvent.click(document.body);

    expect(await screen.findByText('sentry-android-shop@1.2.0')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('triggers search when filtering by releases', async () => {
    const organization = OrganizationFixture();

    // Initialize PageFiltersStore
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        projects: [1],
        environments: ['production'],
      })
    );

    // Mock initial releases
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [
        ReleaseFixture({
          version: 'sentry-android-shop@1.2.0',
          dateCreated: '2021-03-19T01:00:00Z',
        }),
      ],
    });

    // Mock search results
    const searchMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [
        ReleaseFixture({
          version: 'sentry-android-shop@1.2.0',
          dateCreated: '2021-03-19T01:00:00Z',
        }),
      ],
      match: [MockApiClient.matchQuery({query: 'se'})],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });

    render(
      <ReleasesSelectControl
        selectedReleases={[]}
        sortBy={ReleasesSortOption.DATE}
        handleChangeFilter={jest.fn()}
      />,
      {organization}
    );

    expect(await screen.findByText('All Releases')).toBeInTheDocument();

    await userEvent.click(screen.getByText('All Releases'));
    await userEvent.type(screen.getByPlaceholderText('Search…'), 'se');

    await waitFor(() => expect(searchMock).toHaveBeenCalled());
  });

  it('resets search on close', async () => {
    const organization = OrganizationFixture();

    // Initialize PageFiltersStore
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        projects: [1],
        environments: ['production'],
      })
    );

    const initialMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [
        ReleaseFixture({
          version: 'sentry-android-shop@1.2.0',
          dateCreated: '2021-03-19T01:00:00Z',
        }),
      ],
    });

    const searchMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [
        ReleaseFixture({
          version: 'sentry-android-shop@1.2.0',
          dateCreated: '2021-03-19T01:00:00Z',
        }),
      ],
      match: [MockApiClient.matchQuery({query: 'se'})],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });

    render(
      <ReleasesSelectControl
        selectedReleases={[]}
        sortBy={ReleasesSortOption.DATE}
        handleChangeFilter={jest.fn()}
      />,
      {organization}
    );

    expect(await screen.findByText('All Releases')).toBeInTheDocument();

    await userEvent.click(screen.getByText('All Releases'));
    await userEvent.type(screen.getByPlaceholderText('Search…'), 'se');

    await waitFor(() => expect(searchMock).toHaveBeenCalled());

    // Close the dropdown
    await userEvent.click(document.body);

    // Search should be reset - initial mock should be called again
    await waitFor(() => expect(initialMock).toHaveBeenCalledTimes(2));
  });

  it('triggers handleChangeFilter with the release versions', async () => {
    const mockHandleChangeFilter = jest.fn();
    renderReleasesSelect({handleChangeFilter: mockHandleChangeFilter});

    expect(await screen.findByText('All Releases')).toBeInTheDocument();

    await userEvent.click(screen.getByText('All Releases'));
    await userEvent.click(await screen.findByText('Latest Release(s)'));
    await userEvent.click(screen.getByText('sentry-android-shop@1.2.0'));
    await userEvent.click(screen.getByText('sentry-android-shop@1.4.0'));

    await userEvent.click(document.body);

    await waitFor(() => {
      expect(mockHandleChangeFilter).toHaveBeenCalledWith({
        release: ['latest', 'sentry-android-shop@1.2.0', 'sentry-android-shop@1.4.0'],
      });
    });
  });

  it('includes Latest Release(s) even if no matching releases', async () => {
    const organization = OrganizationFixture();

    // Initialize PageFiltersStore
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({
        projects: [1],
        environments: ['production'],
      })
    );

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });

    render(
      <ReleasesSelectControl
        selectedReleases={[]}
        sortBy={ReleasesSortOption.DATE}
        handleChangeFilter={jest.fn()}
      />,
      {organization}
    );

    expect(await screen.findByText('All Releases')).toBeInTheDocument();

    await userEvent.click(screen.getByText('All Releases'));
    await userEvent.type(screen.getByPlaceholderText('Search…'), 'latest');

    expect(await screen.findByText('Latest Release(s)')).toBeInTheDocument();
  });
});
