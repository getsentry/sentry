import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ReleasesContext} from 'sentry/utils/releases/releasesProvider';
import ReleasesSelectControl from 'sentry/views/dashboards/releasesSelectControl';
import {DashboardFilters} from 'sentry/views/dashboards/types';

function renderReleasesSelect({
  onSearch,
  handleChangeFilter,
}: {
  handleChangeFilter?: (activeFilters: DashboardFilters) => void;
  onSearch?: (searchTerm: string) => void;
}) {
  render(
    <ReleasesContext.Provider
      value={{
        releases: [
          TestStubs.Release({
            id: '1',
            shortVersion: 'sentry-android-shop@1.2.0',
            version: 'sentry-android-shop@1.2.0',
          }),
          TestStubs.Release({
            id: '2',
            shortVersion: 'sentry-android-shop@1.3.0',
            version: 'sentry-android-shop@1.3.0',
          }),
          TestStubs.Release({
            id: '3',
            shortVersion: 'sentry-android-shop@1.4.0',
            version: 'sentry-android-shop@1.4.0',
          }),
        ],
        loading: false,
        onSearch: onSearch ?? jest.fn(),
      }}
    >
      <ReleasesSelectControl
        selectedReleases={[]}
        handleChangeFilter={handleChangeFilter}
      />
    </ReleasesContext.Provider>
  );
}

describe('Dashboards > ReleasesSelectControl', function () {
  it('updates menu title with selection', function () {
    renderReleasesSelect({});

    expect(screen.getByText('All Releases')).toBeInTheDocument();

    userEvent.click(screen.getByText('All Releases'));
    expect(screen.getByText('Latest Release(s)')).toBeInTheDocument();
    userEvent.click(screen.getByText('sentry-android-shop@1.2.0'));

    userEvent.click(document.body);

    expect(screen.getByText('sentry-android-shop@1.2.0')).toBeInTheDocument();
    expect(screen.queryByText('+1')).not.toBeInTheDocument();
  });

  it('updates menu title with multiple selections', function () {
    renderReleasesSelect({});

    expect(screen.getByText('All Releases')).toBeInTheDocument();

    userEvent.click(screen.getByText('All Releases'));
    userEvent.click(screen.getByText('sentry-android-shop@1.2.0'));
    userEvent.click(screen.getByText('sentry-android-shop@1.4.0'));

    userEvent.click(document.body);

    expect(screen.getByText('sentry-android-shop@1.2.0')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('calls onSearch when filtering by releases', async function () {
    const mockOnSearch = jest.fn();
    renderReleasesSelect({onSearch: mockOnSearch});

    expect(screen.getByText('All Releases')).toBeInTheDocument();

    userEvent.click(screen.getByText('All Releases'));
    userEvent.type(screen.getByPlaceholderText('Search\u2026'), 'se');

    await waitFor(() => expect(mockOnSearch).toHaveBeenCalledWith('se'));
  });

  it('resets search on close', async function () {
    const mockOnSearch = jest.fn();
    renderReleasesSelect({onSearch: mockOnSearch});

    expect(screen.getByText('All Releases')).toBeInTheDocument();

    userEvent.click(screen.getByText('All Releases'));
    userEvent.type(screen.getByPlaceholderText('Search\u2026'), 'se');

    await waitFor(() => expect(mockOnSearch).toHaveBeenCalledWith('se'));

    userEvent.click(document.body);
    await waitFor(() => expect(mockOnSearch).toHaveBeenCalledWith(''));
  });

  it('triggers handleChangeFilter with the release versions', function () {
    const mockHandleChangeFilter = jest.fn();
    renderReleasesSelect({handleChangeFilter: mockHandleChangeFilter});
    expect(screen.getByText('All Releases')).toBeInTheDocument();

    userEvent.click(screen.getByText('All Releases'));
    userEvent.click(screen.getByText('Latest Release(s)'));
    userEvent.click(screen.getByText('sentry-android-shop@1.2.0'));
    userEvent.click(screen.getByText('sentry-android-shop@1.4.0'));

    userEvent.click(document.body);

    expect(mockHandleChangeFilter).toHaveBeenCalledWith({
      release: ['latest', 'sentry-android-shop@1.2.0', 'sentry-android-shop@1.4.0'],
    });
  });

  it('includes Latest Release(s) even if no matching releases', function () {
    render(
      <ReleasesContext.Provider
        value={{
          releases: [],
          loading: false,
          onSearch: jest.fn(),
        }}
      >
        <ReleasesSelectControl selectedReleases={[]} handleChangeFilter={jest.fn()} />
      </ReleasesContext.Provider>
    );

    expect(screen.getByText('All Releases')).toBeInTheDocument();

    userEvent.click(screen.getByText('All Releases'));
    userEvent.type(screen.getByPlaceholderText('Search\u2026'), 'latest');

    screen.getByText('Latest Release(s)');
  });
});
