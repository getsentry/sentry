import {OrganizationFixture} from 'sentry-fixture/organization';
import {PreprodBuildDetailsWithSizeInfoFixture} from 'sentry-fixture/preprod';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {TopBar} from 'sentry/views/navigation/topBar';
import {BuildDetailsSizeAnalysisState} from 'sentry/views/preprod/types/buildDetailsTypes';

import InstallPage from './installPage';

describe('InstallPage', () => {
  const organization = OrganizationFixture();

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/preprod/install/artifact-1/`,
      query: {project: 'project-1'},
    },
    route: '/organizations/:orgId/preprod/install/:artifactId/',
  };

  const BUILD_DETAILS_URL =
    '/organizations/org-slug/preprodartifacts/artifact-1/build-details/';
  const INSTALL_DETAILS_URL =
    '/organizations/org-slug/preprodartifacts/artifact-1/private-install-details/';

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: BUILD_DETAILS_URL,
      method: 'GET',
      body: PreprodBuildDetailsWithSizeInfoFixture({
        state: BuildDetailsSizeAnalysisState.COMPLETED,
        size_metrics: [],
        base_size_metrics: [],
      }),
    });
    MockApiClient.addMockResponse({
      url: INSTALL_DETAILS_URL,
      method: 'GET',
      body: {platform: 'ios'},
    });
  });

  function renderInstallPage() {
    return render(
      <TopBar.Slot.Provider>
        <TopBar.Slot.Outlet name="title">
          {props => <div {...props} data-test-id="topbar-title-slot" />}
        </TopBar.Slot.Outlet>
        <InstallPage />
      </TopBar.Slot.Provider>,
      {organization, initialRouterConfig}
    );
  }

  it('renders the Releases breadcrumb linking to the mobile-builds distribution view', async () => {
    renderInstallPage();

    expect(await screen.findByText('Test App')).toBeInTheDocument();

    const topbarSlot = screen.getByTestId('topbar-title-slot');
    const releasesLink = within(topbarSlot).getByRole('link', {name: 'Releases'});

    expect(releasesLink).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/explore/releases/?project=test-project&tab=mobile-builds&display=distribution&query=installable%3Atrue`
    );
  });

  it('renders the app info as the current crumb after Releases', async () => {
    renderInstallPage();

    expect(await screen.findByText('Test App')).toBeInTheDocument();

    const topbarSlot = screen.getByTestId('topbar-title-slot');

    expect(within(topbarSlot).getByRole('link', {name: 'Releases'})).toBeInTheDocument();
    expect(within(topbarSlot).getByText('Test App')).toBeInTheDocument();
    expect(within(topbarSlot).getByText('v1.0.0 (123)')).toBeInTheDocument();
    expect(within(topbarSlot).queryByText('Install')).not.toBeInTheDocument();
  });

  it('surfaces install groups from build details', async () => {
    MockApiClient.addMockResponse({
      url: BUILD_DETAILS_URL,
      method: 'GET',
      body: PreprodBuildDetailsWithSizeInfoFixture(
        {
          state: BuildDetailsSizeAnalysisState.COMPLETED,
          size_metrics: [],
          base_size_metrics: [],
        },
        {
          distribution_info: {
            is_installable: true,
            download_count: 0,
            release_notes: null,
            install_groups: ['qa', 'beta'],
          },
        }
      ),
    });
    MockApiClient.addMockResponse({
      url: INSTALL_DETAILS_URL,
      method: 'GET',
      body: {platform: 'ios', install_url: 'https://example.com/install'},
    });

    renderInstallPage();

    expect(await screen.findByText('Install Groups')).toBeInTheDocument();
    expect(screen.getByText('qa')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
  });

  it('keeps the Releases breadcrumb clickable when build details fail to load', async () => {
    MockApiClient.addMockResponse({
      url: BUILD_DETAILS_URL,
      method: 'GET',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    renderInstallPage();

    expect(await screen.findByText('Install')).toBeInTheDocument();

    const topbarSlot = screen.getByTestId('topbar-title-slot');

    const releasesLink = within(topbarSlot).getByRole('link', {name: 'Releases'});
    expect(releasesLink).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/explore/releases/?tab=mobile-builds&display=distribution&query=installable%3Atrue`
    );
    expect(within(topbarSlot).getByText('Install')).toBeInTheDocument();
  });
});
