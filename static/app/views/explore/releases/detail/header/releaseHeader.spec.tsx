import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReleaseFixture} from 'sentry-fixture/release';
import {ReleaseMetaFixture} from 'sentry-fixture/releaseMeta';
import {ReleaseProjectFixture} from 'sentry-fixture/releaseProject';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import type {RouterConfig} from 'sentry-test/reactTestingLibrary';

import type {Release, ReleaseProject} from 'sentry/types/release';
import {ReleaseStatus} from 'sentry/types/release';
import {TopBar} from 'sentry/views/navigation/topBar';

import {ReleaseHeader} from './releaseHeader';

jest.mock('sentry/utils/useFeedbackForm', () => ({
  useFeedbackForm: () => jest.fn(),
}));

describe('ReleaseHeader', () => {
  const organization = OrganizationFixture();

  const project = ReleaseProjectFixture({
    id: 1,
    slug: 'sentry-android-shop',
    platform: 'android',
  }) as Required<ReleaseProject>;

  const releaseMeta = ReleaseMetaFixture({projects: [project]});

  function renderHeader({
    org = organization,
    pathname,
    refetchData = jest.fn(),
    release,
  }: {
    release: Release;
    org?: typeof organization;
    pathname?: string;
    refetchData?: () => void;
  }) {
    const locationPathname =
      pathname ?? `/organizations/${org.slug}/releases/${release.version}/`;
    const query = {project: String(project.id)};
    const location = LocationFixture({pathname: locationPathname, query});
    const initialRouterConfig: RouterConfig = {
      location: {pathname: locationPathname, query},
    };

    return render(
      <TopBar.Slot.Provider>
        <TopBar />
        <ReleaseHeader
          location={location}
          organization={org}
          project={project}
          refetchData={refetchData}
          release={release}
          releaseMeta={{...releaseMeta, version: release.version}}
        />
      </TopBar.Slot.Provider>,
      {organization: org, initialRouterConfig}
    );
  }

  it('renders a Releases parent link and the release version as the title', () => {
    const release = ReleaseFixture({version: '0c7d1730b1b1', projects: [project]});
    renderHeader({release});

    const trail = screen.getByRole('list');
    expect(within(trail).getByRole('link', {name: 'Releases'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/explore/releases/?project=${project.id}`
    );
    expect(
      screen.getByRole('heading', {name: release.version, level: 1})
    ).toBeInTheDocument();
    // The leaf must not also render inside the parent trail.
    expect(within(trail).queryByText(release.version)).not.toBeInTheDocument();
  });

  it('preserves the project filter on the Releases link for a different org', () => {
    const pageFrameOrg = OrganizationFixture();
    const release = ReleaseFixture({version: '0c7d1730b1b1', projects: [project]});
    renderHeader({org: pageFrameOrg, release});

    expect(screen.getByRole('link', {name: 'Releases'})).toHaveAttribute(
      'href',
      `/organizations/${pageFrameOrg.slug}/explore/releases/?project=${project.id}`
    );
  });

  it('does not render an external link action when the release has no url', () => {
    const release = ReleaseFixture({
      version: '0c7d1730b1b1',
      projects: [project],
      url: '',
    });
    renderHeader({release});

    expect(
      screen.queryByRole('button', {name: 'Open release URL'})
    ).not.toBeInTheDocument();
  });

  it('renders an external link action when the release has a url', () => {
    const release = ReleaseFixture({
      version: '0c7d1730b1b1',
      projects: [project],
      url: 'https://example.com/release/0c7d1730b1b1',
    });
    renderHeader({release});

    expect(screen.getByRole('button', {name: 'Open release URL'})).toHaveAttribute(
      'href',
      release.url
    );
  });

  it('renders exactly one feedback button in the top bar', () => {
    const release = ReleaseFixture({version: '0c7d1730b1b1', projects: [project]});
    renderHeader({release});

    expect(screen.getAllByRole('button', {name: 'Give Feedback'})).toHaveLength(1);
  });

  describe('actions menu', () => {
    beforeEach(() => {
      MockApiClient.clearMockResponses();
    });

    it('copies the release version from the menu rather than a standalone button', async () => {
      Object.assign(navigator, {
        clipboard: {writeText: jest.fn().mockResolvedValue('')},
      });
      const release = ReleaseFixture({version: '0c7d1730b1b1', projects: [project]});
      renderHeader({release});

      // The copy affordance lives in the menu now, not beside the title.
      expect(
        screen.queryByRole('button', {name: 'Copy release version to clipboard'})
      ).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Release Actions'}));

      expect(screen.getAllByRole('menuitemradio').map(el => el.textContent)).toEqual([
        'Copy release version to clipboard',
        'Archive',
      ]);

      await userEvent.click(
        screen.getByRole('menuitemradio', {name: 'Copy release version to clipboard'})
      );

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(release.version);
    });

    it('archives a release', async () => {
      const mockUpdate = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/releases/`,
        method: 'POST',
      });
      const release = ReleaseFixture({projects: [project]});
      const {router} = renderHeader({release});
      renderGlobalModal();

      await userEvent.click(screen.getByRole('button', {name: 'Release Actions'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Archive'}));

      expect(await screen.findByText('Archive Release 1.2.0')).toBeInTheDocument();
      const modal = screen.getByRole('dialog');
      expect(within(modal).getByText(project.slug)).toBeInTheDocument();

      await userEvent.click(within(modal).getByRole('button', {name: 'Archive'}));

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {projects: [], status: 'archived', version: release.version},
        })
      );
      await waitFor(() =>
        expect(router.location).toEqual(
          expect.objectContaining({
            pathname: `/organizations/${organization.slug}/explore/releases/`,
          })
        )
      );
    });

    it('restores an archived release', async () => {
      const mockUpdate = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/releases/`,
        method: 'POST',
      });
      const refetchData = jest.fn();
      const release = ReleaseFixture({
        projects: [project],
        status: ReleaseStatus.ARCHIVED,
      });
      renderHeader({release, refetchData});
      renderGlobalModal();

      await userEvent.click(screen.getByRole('button', {name: 'Release Actions'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Restore'}));

      expect(await screen.findByText('Restore Release 1.2.0')).toBeInTheDocument();

      await userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {name: 'Restore'})
      );

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {projects: [], status: 'open', version: release.version},
        })
      );
      await waitFor(() => expect(refetchData).toHaveBeenCalledTimes(1));
    });
  });

  describe('pagination', () => {
    it('links to the older and newer releases', () => {
      const release = ReleaseFixture({projects: [project]});
      renderHeader({release});

      expect(screen.getByRole('button', {name: 'Older'})).toHaveAttribute(
        'href',
        `/organizations/${organization.slug}/releases/123/?project=${project.id}`
      );
      expect(screen.getByRole('button', {name: 'Newer'})).toHaveAttribute(
        'href',
        `/organizations/${organization.slug}/releases/456/?project=${project.id}`
      );
    });

    it('no longer renders the Oldest and Newest jump links', () => {
      const release = ReleaseFixture({projects: [project]});
      renderHeader({release});

      expect(screen.queryByRole('button', {name: 'Oldest'})).not.toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Newest'})).not.toBeInTheDocument();
    });

    it('stays on the current sub-page when paginating', () => {
      const release = ReleaseFixture({projects: [project]});
      renderHeader({
        release,
        pathname: `/organizations/${organization.slug}/releases/${encodeURIComponent(
          release.version
        )}/files-changed/`,
      });

      expect(screen.getByRole('button', {name: 'Newer'})).toHaveAttribute(
        'href',
        `/organizations/${organization.slug}/releases/456/files-changed/?project=${project.id}`
      );
    });

    it('does not corrupt the path when a sibling version extends the current one', () => {
      const release = ReleaseFixture({
        version: '1.0',
        projects: [project],
        currentProjectMeta: {
          ...ReleaseFixture().currentProjectMeta,
          nextReleaseVersion: '1.0.1',
        },
      });
      renderHeader({release});

      expect(screen.getByRole('button', {name: 'Newer'})).toHaveAttribute(
        'href',
        `/organizations/${organization.slug}/releases/1.0.1/?project=${project.id}`
      );
    });

    it('disables a direction with no neighbouring release', () => {
      const release = ReleaseFixture({
        projects: [project],
        currentProjectMeta: {
          ...ReleaseFixture().currentProjectMeta,
          nextReleaseVersion: null,
        },
      });
      renderHeader({release});

      expect(screen.getByRole('button', {name: 'Newer'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      expect(screen.getByRole('button', {name: 'Older'})).not.toHaveAttribute(
        'aria-disabled'
      );
    });
  });
});
