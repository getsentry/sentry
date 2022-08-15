import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ReleasesContext} from 'sentry/utils/releases/releasesProvider';
import ReleasesSelectControl from 'sentry/views/dashboardsV2/releasesSelectControl';

function renderReleasesSelect(onSearch?: (searchTerm: string) => void) {
  render(
    <ReleasesContext.Provider
      value={{
        releases: [
          TestStubs.Release({
            shortVersion: 'sentry-android-shop@1.2.0',
            version: 'sentry-android-shop@1.2.0',
          }),
          TestStubs.Release({
            shortVersion: 'sentry-android-shop@1.3.0',
            version: 'sentry-android-shop@1.3.0',
          }),
          TestStubs.Release({
            shortVersion: 'sentry-android-shop@1.4.0',
            version: 'sentry-android-shop@1.4.0',
          }),
        ],
        loading: false,
        onSearch: onSearch ?? jest.fn(),
      }}
    >
      <ReleasesSelectControl selectedReleases={[]} />
    </ReleasesContext.Provider>
  );
}

describe('Dashboards > ReleasesSelectControl', function () {
  it('updates menu title with selection', function () {
    renderReleasesSelect();

    expect(screen.getByText('All Releases')).toBeInTheDocument();

    userEvent.click(screen.getByText('All Releases'));
    expect(screen.getByText('Latest Release(s)')).toBeInTheDocument();
    userEvent.click(screen.getByText('sentry-android-shop@1.2.0'));

    userEvent.click(document.body);

    expect(screen.getByText('sentry-android-shop@1.2.0')).toBeInTheDocument();
    expect(screen.queryByText('+1')).not.toBeInTheDocument();
  });

  it('updates menu title with multiple selections', function () {
    renderReleasesSelect();

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
    renderReleasesSelect(mockOnSearch);

    expect(screen.getByText('All Releases')).toBeInTheDocument();

    userEvent.click(screen.getByText('All Releases'));
    userEvent.type(screen.getByText('Search\u2026'), 'se');

    await waitFor(() => expect(mockOnSearch).toBeCalledWith('se'));
  });

  it('resets search on close', async function () {
    const mockOnSearch = jest.fn();
    renderReleasesSelect(mockOnSearch);

    expect(screen.getByText('All Releases')).toBeInTheDocument();

    userEvent.click(screen.getByText('All Releases'));
    userEvent.type(screen.getByText('Search\u2026'), 'se');

    await waitFor(() => expect(mockOnSearch).toBeCalledWith('se'));

    userEvent.click(document.body);
    await waitFor(() => expect(mockOnSearch).toBeCalledWith(''));
  });
});
