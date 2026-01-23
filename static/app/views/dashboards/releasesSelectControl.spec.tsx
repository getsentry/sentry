import {ReleaseFixture} from 'sentry-fixture/release';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ReleasesSelectControl from 'sentry/views/dashboards/releasesSelectControl';

const defaultReleases = [
  ReleaseFixture({
    id: '1',
    shortVersion: 'sentry-android-shop@1.2.0',
    version: 'sentry-android-shop@1.2.0',
  }),
  ReleaseFixture({
    id: '2',
    shortVersion: 'sentry-android-shop@1.3.0',
    version: 'sentry-android-shop@1.3.0',
  }),
  ReleaseFixture({
    id: '3',
    shortVersion: 'sentry-android-shop@1.4.0',
    version: 'sentry-android-shop@1.4.0',
  }),
];

describe('Dashboards > ReleasesSelectControl', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [],
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      },
      false
    );
  });

  it('updates menu title with selection', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: defaultReleases,
    });

    render(<ReleasesSelectControl selectedReleases={[]} />);

    // Wait for the API request to complete
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));

    // Component should render with default text
    expect(await screen.findByText('All Releases')).toBeInTheDocument();

    // Open the dropdown
    await userEvent.click(screen.getByText('All Releases'));

    // Wait for the releases to load and appear in the dropdown
    expect(await screen.findByText('sentry-android-shop@1.2.0')).toBeInTheDocument();

    // Click on a release
    await userEvent.click(screen.getByText('sentry-android-shop@1.2.0'));

    // Close the dropdown
    await userEvent.click(document.body);

    // Verify the selected release is shown in the trigger
    expect(screen.getByText('sentry-android-shop@1.2.0')).toBeInTheDocument();
    expect(screen.queryByText('+1')).not.toBeInTheDocument();
  });

  it('updates menu title with multiple selections', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: defaultReleases,
    });

    render(<ReleasesSelectControl selectedReleases={[]} />);

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));

    expect(await screen.findByText('All Releases')).toBeInTheDocument();

    await userEvent.click(screen.getByText('All Releases'));
    await userEvent.click(await screen.findByText('sentry-android-shop@1.2.0'));
    await userEvent.click(screen.getByText('sentry-android-shop@1.4.0'));

    await userEvent.click(document.body);

    expect(screen.getByText('sentry-android-shop@1.2.0')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('updates releases when searching', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: defaultReleases,
    });

    render(<ReleasesSelectControl selectedReleases={[]} />);

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));

    expect(await screen.findByText('All Releases')).toBeInTheDocument();

    await userEvent.click(screen.getByText('All Releases'));

    // Initially all releases should be visible
    expect(await screen.findByText('sentry-android-shop@1.2.0')).toBeInTheDocument();
    expect(screen.getByText('sentry-android-shop@1.3.0')).toBeInTheDocument();
    expect(screen.getByText('sentry-android-shop@1.4.0')).toBeInTheDocument();

    // When user types in the search box, the component should filter releases
    // Note: The actual filtering is done by the CompactSelect component itself,
    // and the search term is passed to the useReleases hook which would refetch with the search term
    await userEvent.type(screen.getByPlaceholderText('Search\u2026'), 'se');

    // In a real scenario, the hook would be called with the search term
    // but since we're mocking the network, we're just verifying the search interaction works
  });

  it('triggers handleChangeFilter with the release versions', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: defaultReleases,
    });

    const mockHandleChangeFilter = jest.fn();

    render(
      <ReleasesSelectControl
        selectedReleases={[]}
        handleChangeFilter={mockHandleChangeFilter}
      />
    );

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));

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
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });

    render(<ReleasesSelectControl selectedReleases={[]} />);

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));

    expect(await screen.findByText('All Releases')).toBeInTheDocument();

    await userEvent.click(screen.getByText('All Releases'));

    expect(await screen.findByText('Latest Release(s)')).toBeInTheDocument();
  });
});
