import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';

import SeerAutomation from 'getsentry/views/seerAutomation/seerAutomation';

describe('SeerAutomation', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      method: 'GET',
      body: {
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
        billing: {
          hasAutofixQuota: true,
          hasScannerQuota: true,
        },
      },
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/seer/preferences/',
      method: 'GET',
      body: {
        repositories: [],
      },
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.resetAllMocks();
    ProjectsStore.reset();
  });

  it('can update the org default autofix automation tuning setting', async () => {
    const organization = OrganizationFixture({
      defaultSeerScannerAutomation: true,
    });
    const project = ProjectFixture();
    ProjectsStore.loadInitialData([project]);

    const orgPutRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: {defaultAutofixAutomationTuning: 'high'},
    });

    // Project details used to populate the project list
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/`,
      method: 'GET',
      body: {
        ...project,
        autofixAutomationTuning: 'off',
      },
    });

    render(<SeerAutomation />, {organization});

    // Project details populate the project list
    const projectItem = await screen.findByText(project.slug);
    expect(projectItem).toBeInTheDocument();

    // Find the panel item containing the project
    const panelItem = projectItem.closest('[class*="PanelItem"]');
    expect(panelItem).toBeInTheDocument();
    expect(panelItem).toHaveTextContent('Off');

    // Find the select menu
    const select = await screen.findByRole('textbox', {
      name: /Default for Auto-Triggered Fixes/i,
    });

    act(() => {
      select.focus();
    });

    // Open the menu and select a new value (e.g., 'Only the Most Actionable Issues')
    await userEvent.click(select);
    const option = await screen.findByText('Only the Most Actionable Issues');
    await userEvent.click(option);

    act(() => {
      select.blur();
    });

    await waitFor(() => {
      expect(orgPutRequest).toHaveBeenCalledTimes(1);
    });
    expect(orgPutRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/`,
      expect.objectContaining({
        data: {defaultAutofixAutomationTuning: 'super_low'},
      })
    );
  });

  it('can update the org default scanner automation setting', async () => {
    const organization = OrganizationFixture({
      defaultSeerScannerAutomation: false,
    });
    const project = ProjectFixture();
    ProjectsStore.loadInitialData([project]);

    const orgPutRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: {defaultSeerScannerAutomation: true},
    });

    // Project details used to populate the project list
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/`,
      method: 'GET',
      body: {
        ...project,
        seerScannerAutomation: false,
      },
    });

    render(<SeerAutomation />, {organization});

    // Find the toggle for Default for Issue Scans
    const toggle = await screen.findByRole('checkbox', {
      name: /Default for Issue Scans/i,
    });
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeChecked();

    // Toggle it on
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(orgPutRequest).toHaveBeenCalledTimes(1);
    });
    expect(orgPutRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/`,
      expect.objectContaining({
        data: {defaultSeerScannerAutomation: true},
      })
    );
  });
});
