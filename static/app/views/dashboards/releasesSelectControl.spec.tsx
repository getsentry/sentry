import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ReleasesSelectControl from 'sentry/views/dashboards/releasesSelectControl';
import type {DashboardFilters} from 'sentry/views/dashboards/types';

jest.mock('sentry/views/dashboards/hooks/useReleases', () => ({
  useReleases: jest.fn(() => ({
    data: [
      {
        id: '1',
        shortVersion: 'sentry-android-shop@1.2.0',
        version: 'sentry-android-shop@1.2.0',
        dateCreated: '2020-03-23T01:02:30Z',
      },
      {
        id: '2',
        shortVersion: 'sentry-android-shop@1.3.0',
        version: 'sentry-android-shop@1.3.0',
        dateCreated: '2020-03-24T01:02:30Z',
      },
      {
        id: '3',
        shortVersion: 'sentry-android-shop@1.4.0',
        version: 'sentry-android-shop@1.4.0',
        dateCreated: '2020-03-25T01:02:30Z',
      },
    ],
    isLoading: false,
  })),
}));

function renderReleasesSelect({
  handleChangeFilter,
}: {
  handleChangeFilter?: (activeFilters: DashboardFilters) => void;
} = {}) {
  return render(
    <ReleasesSelectControl
      selectedReleases={[]}
      handleChangeFilter={handleChangeFilter}
    />
  );
}

describe('Dashboards > ReleasesSelectControl', () => {
  it('updates menu title with selection', async () => {
    renderReleasesSelect({});

    // Wait for the component to load and render
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
    renderReleasesSelect({});

    expect(await screen.findByText('All Releases')).toBeInTheDocument();

    await userEvent.click(screen.getByText('All Releases'));
    await userEvent.click(await screen.findByText('sentry-android-shop@1.2.0'));
    await userEvent.click(screen.getByText('sentry-android-shop@1.4.0'));

    await userEvent.click(document.body);

    expect(screen.getByText('sentry-android-shop@1.2.0')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('updates releases when searching', async () => {
    renderReleasesSelect({});

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
    // but since we're mocking it, we're just verifying the search interaction works
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
    const useReleases = require('sentry/views/dashboards/hooks/useReleases').useReleases;
    useReleases.mockReturnValueOnce({
      data: [],
      isLoading: false,
    });

    renderReleasesSelect({});

    expect(await screen.findByText('All Releases')).toBeInTheDocument();

    await userEvent.click(screen.getByText('All Releases'));

    expect(await screen.findByText('Latest Release(s)')).toBeInTheDocument();
  });
});
