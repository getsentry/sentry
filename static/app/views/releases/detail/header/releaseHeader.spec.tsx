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
  const organization = OrganizationFixture();

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

  function renderHeader(org = organization) {
    const pathname = `/organizations/${org.slug}/releases/${release.version}/`;
    const query = {project: String(project.id)};
    const location = LocationFixture({pathname, query});
    const initialRouterConfig: RouterConfig = {location: {pathname, query}};

    return render(
      <TopBar.Slot.Provider>
        <TopBar.Slot.Outlet name="title">
          {props => <div {...props} data-test-id="topbar-title-slot" />}
        </TopBar.Slot.Outlet>
        <ReleaseHeader
          location={location}
          organization={org}
          project={project}
          refetchData={jest.fn()}
          release={release}
          releaseMeta={releaseMeta}
        />
      </TopBar.Slot.Provider>,
      {organization: org, initialRouterConfig}
    );
  }

  it('renders breadcrumbs with a link to releases and the release version', () => {
    renderHeader();

    const breadcrumbs = screen.getByTestId('breadcrumb-list');
    expect(within(breadcrumbs).getByRole('link', {name: 'Releases'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/explore/releases/?project=${project.id}`
    );
    expect(screen.getByText(release.version)).toBeInTheDocument();
  });

  it('renders breadcrumbs with release version in the top bar when page frame is enabled', () => {
    const pageFrameOrg = OrganizationFixture({features: ['page-frame']});
    renderHeader(pageFrameOrg);

    const topbarSlot = screen.getByTestId('topbar-title-slot');
    const breadcrumbs = within(topbarSlot).getByTestId('breadcrumb-list');

    expect(within(breadcrumbs).getByRole('link', {name: 'Releases'})).toHaveAttribute(
      'href',
      `/organizations/${pageFrameOrg.slug}/explore/releases/?project=${project.id}`
    );
    expect(within(topbarSlot).getByText(release.version)).toBeInTheDocument();
  });
});
