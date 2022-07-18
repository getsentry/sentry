import selectEvent from 'react-select-event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ReleasesContext} from 'sentry/utils/releases/releasesProvider';
import ReleasesSelectControl from 'sentry/views/dashboardsV2/releasesSelectControl';

function renderReleasesSelect() {
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
      }}
    >
      <ReleasesSelectControl />
    </ReleasesContext.Provider>
  );
}

describe('Dashboards > ReleasesSelectControl', function () {
  it('updates menu title with selection', async function () {
    renderReleasesSelect();

    expect(screen.getByText('All Releases')).toBeInTheDocument();
    await selectEvent.select(
      screen.getByText('All Releases'),
      'sentry-android-shop@1.2.0'
    );

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
});
