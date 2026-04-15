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

  it('renders breadcrumbs and title inside the header without page frame', () => {
    renderHeader();

    const header = screen.getByRole('tablist').closest('header')!;
    expect(within(header).getByTestId('breadcrumb-list')).toBeInTheDocument();
    expect(within(header).getByText(release.version)).toBeInTheDocument();
  });

  it('moves breadcrumbs and title into the top bar when page frame is enabled', () => {
    renderHeader(OrganizationFixture({features: ['page-frame']}));

    const topbarSlot = screen.getByTestId('topbar-title-slot');
    expect(within(topbarSlot).getByTestId('breadcrumb-list')).toBeInTheDocument();
    expect(within(topbarSlot).getByText(release.version)).toBeInTheDocument();
  });
});
