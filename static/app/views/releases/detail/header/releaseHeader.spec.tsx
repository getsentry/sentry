import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReleaseFixture} from 'sentry-fixture/release';
import {ReleaseMetaFixture} from 'sentry-fixture/releaseMeta';
import {ReleaseProjectFixture} from 'sentry-fixture/releaseProject';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';
import type {RouterConfig} from 'sentry-test/reactTestingLibrary';

import type {ReleaseProject} from 'sentry/types/release';
import {TopBar} from 'sentry/views/navigation/topBar';

import {ReleaseHeader} from './releaseHeader';

describe('ReleaseHeader', () => {
  const project = ReleaseProjectFixture({
    id: 1,
    slug: 'sentry-android-shop',
    platform: 'android',
  }) as Required<ReleaseProject>;

  const release = ReleaseFixture({
    version: '0c7d1730b1b1',
    projects: [project],
  });

  const releaseMeta = ReleaseMetaFixture({
    version: release.version,
    projects: [project],
  });

  function renderHeader(organization = OrganizationFixture()) {
    const pathname = `/organizations/${organization.slug}/releases/${release.version}/`;
    const query = {
      project: String(project.id),
    };
    const location = LocationFixture({pathname, query});

    const initialRouterConfig: RouterConfig = {location: {pathname, query}};

    return render(
      <TopBar.Slot.Provider>
        <div data-test-id="topbar-title">
          <TopBar.Slot.Outlet name="title">
            {props => <div {...props} data-test-id="topbar-title-slot" />}
          </TopBar.Slot.Outlet>
        </div>
        <ReleaseHeader
          location={location}
          organization={organization}
          project={project}
          refetchData={jest.fn()}
          release={release}
          releaseMeta={releaseMeta}
        />
      </TopBar.Slot.Provider>,
      {
        organization,
        initialRouterConfig,
      }
    );
  }

  it('renders breadcrumbs inside the page header without page frame', () => {
    renderHeader();

    const header = screen.getByRole('tablist').closest('header');
    expect(header).not.toBeNull();

    expect(within(header!).getByTestId('breadcrumb-list')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('topbar-title')).queryByTestId('breadcrumb-list')
    ).not.toBeInTheDocument();
  });

  it('moves breadcrumbs into the top bar when page frame is enabled', () => {
    const organization = OrganizationFixture({features: ['page-frame']});
    renderHeader(organization);

    const header = screen.getByRole('tablist').closest('header');
    expect(header).not.toBeNull();

    expect(within(header!).queryByTestId('breadcrumb-list')).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('topbar-title-slot')).getByTestId('breadcrumb-list')
    ).toBeInTheDocument();
    expect(within(header!).getByText(release.version)).toBeInTheDocument();
  });
});
