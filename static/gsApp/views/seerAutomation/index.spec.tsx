import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';

import SeerAutomationRoot from './index';

describe('SeerAutomation', function () {
  beforeEach(() => {
    // Mock the seer setup check endpoint for all tests
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
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.resetAllMocks();
    ProjectsStore.reset();
  });

  it('can update the org default autofix automation tuning setting', async function () {
    const organization = OrganizationFixture({
      features: ['trigger-autofix-on-issue-summary'],
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

    render(<SeerAutomationRoot />, {organization});

    // Project details populate the project list
    const projectItem = await screen.findByRole('link', {name: project.slug});
    expect(projectItem).toBeInTheDocument();
    expect(projectItem.parentElement!.parentElement).toHaveTextContent('Off');

    // Find the select menu
    const select = await screen.findByRole('textbox', {
      name: /Default for Automatic Issue Fixes/i,
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

  it('can update the org default scanner automation setting', async function () {
    const organization = OrganizationFixture({
      features: ['trigger-autofix-on-issue-summary'],
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

    render(<SeerAutomationRoot />, {organization});

    // Find the toggle for Default for Automatic Issue Scans
    const toggle = await screen.findByRole('checkbox', {
      name: /Default for Automatic Issue Scans/i,
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
