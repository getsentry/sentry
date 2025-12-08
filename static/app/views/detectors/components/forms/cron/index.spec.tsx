import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {DetectorFormProvider} from 'sentry/views/detectors/components/forms/context';

import {NewCronDetectorForm} from './index';

describe('NewCronDetectorForm', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  beforeEach(() => {
    OrganizationStore.init();
    OrganizationStore.onUpdate(organization, {replace: true});
    ProjectsStore.loadInitialData([project]);

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/`,
      body: [],
    });
  });

  const renderForm = (routerConfig?: any) => {
    return render(
      <DetectorFormProvider detectorType="monitor_check_in_failure" project={project}>
        <NewCronDetectorForm />
      </DetectorFormProvider>,
      {
        organization,
        initialRouterConfig: routerConfig,
      }
    );
  };

  it('renders form sections when no guide is shown', async () => {
    renderForm();

    // Form sections should be visible
    expect(await screen.findByText('Detect')).toBeInTheDocument();
    expect(screen.getByText('Assign')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();

    // Create Monitor button should be present and enabled
    const createButton = screen.getByRole('button', {name: 'Create Monitor'});
    expect(createButton).toBeInTheDocument();
    expect(createButton).toBeEnabled();
  });

  it('hides form sections and disables create button when a platform guide is shown', async () => {
    renderForm({
      location: {
        pathname: '/test/',
        query: {platform: 'php', guide: 'upsert'},
      },
    });

    // Wait for render to complete
    await screen.findByText('Step 2 of 2');

    // Form sections should be hidden
    expect(screen.queryByText('Detect')).not.toBeInTheDocument();
    expect(screen.queryByText('Assign')).not.toBeInTheDocument();
    expect(screen.queryByText('Description')).not.toBeInTheDocument();

    // Create Monitor button should be present but disabled
    const createButton = screen.getByRole('button', {name: 'Create Monitor'});
    expect(createButton).toBeInTheDocument();
    expect(createButton).toBeDisabled();
  });

  it('shows form sections and enabled button when guide is set to "manual"', async () => {
    renderForm({
      location: {
        pathname: '/test/',
        query: {platform: 'php', guide: 'manual'},
      },
    });

    // Form sections should be visible even with platform set, because guide is "manual"
    expect(await screen.findByText('Detect')).toBeInTheDocument();
    expect(screen.getByText('Assign')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();

    // Create Monitor button should be present and enabled
    const createButton = screen.getByRole('button', {name: 'Create Monitor'});
    expect(createButton).toBeInTheDocument();
    expect(createButton).toBeEnabled();
  });
});
