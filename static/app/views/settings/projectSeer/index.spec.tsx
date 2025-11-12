import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import type {SeerPreferencesResponse} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import ProjectSeer from 'sentry/views/settings/projectSeer';

// Needed to mock useVirtualizer lists.
jest.spyOn(window.Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
  x: 0,
  y: 0,
  width: 0,
  height: 30,
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
  toJSON: jest.fn(),
}));

describe('ProjectSeer', () => {
  let project: Project;
  let organization: Organization;

  beforeEach(() => {
    project = ProjectFixture();
    organization = OrganizationFixture({
      features: ['autofix-seer-preferences'],
    });

    // Mock the seer setup check endpoint
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/setup-check/`,
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
      url: `/organizations/${organization.slug}/repos/`,
      query: {status: 'active'},
      method: 'GET',
      body: [
        RepositoryFixture({
          id: '1',
          name: 'getsentry/sentry',
          externalId: '101',
          provider: {id: 'integrations:github', name: 'GitHub'},
          integrationId: '201',
        }),
        RepositoryFixture({
          id: '2',
          name: 'getsentry/seer',
          externalId: '102',
          provider: {id: 'integrations:github', name: 'GitHub'},
          integrationId: '202',
        }),
      ],
    });

    const seerPreferencesResponse: SeerPreferencesResponse = {
      code_mapping_repos: [
        {
          provider: 'github',
          owner: 'getsentry',
          name: 'sentry',
          external_id: '101',
        },
      ],
    };

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'GET',
      body: seerPreferencesResponse,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      method: 'GET',
      body: {
        integrations: [],
      },
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('can add a repository', async () => {
    const seerPreferencesPostRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'POST',
    });

    render(<ProjectSeer />, {
      organization,
      outletContext: {project},
    });
    renderGlobalModal();

    // Wait for initial repos to load
    expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();
    expect(screen.queryByText('getsentry/seer')).not.toBeInTheDocument();

    // Open the add repo modal
    await userEvent.click(screen.getByRole('button', {name: 'Add Repos'}));

    // Find and select the unselected repo in the modal
    const modal = await screen.findByRole('dialog');
    await userEvent.click(
      await within(modal).findByRole('button', {name: /getsentry\/seer/})
    );

    // Save changes in the modal
    await userEvent.click(within(modal).getByRole('button', {name: 'Add 1 Repository'}));

    // Wait for modal to close and repo list to update
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('getsentry/seer')).toBeInTheDocument();

    await waitFor(() => {
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            automated_run_stopping_point: 'root_cause',
            repositories: [
              {
                organization_id: 3,
                branch_name: '',
                external_id: '101',
                instructions: '',
                name: 'sentry',
                owner: 'getsentry',
                provider: 'github',
                integration_id: '201',
                branch_overrides: [],
              },
              {
                organization_id: 3,
                branch_name: '',
                external_id: '102',
                instructions: '',
                name: 'seer',
                owner: 'getsentry',
                provider: 'github',
                integration_id: '202',
                branch_overrides: [],
              },
            ],
          }),
        })
      );
    });
    expect(seerPreferencesPostRequest).toHaveBeenCalledTimes(1);
  });

  it('can update repository settings', async () => {
    const seerPreferencesPostRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'POST',
    });

    render(<ProjectSeer />, {
      organization,
      outletContext: {project},
    });
    renderGlobalModal();

    const repoItem = await screen.findByText('getsentry/sentry');

    // Expand the repo item
    await userEvent.click(repoItem);

    // Find input fields
    const branchInput = screen.getByPlaceholderText('Default branch');
    const instructionsInput = screen.getByPlaceholderText(
      'Add any general context or instructions to help Seer understand this repository...'
    );

    await userEvent.type(branchInput, 'develop');
    await userEvent.type(instructionsInput, 'Use Conventional Commits');

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            automated_run_stopping_point: 'root_cause',
            repositories: [
              {
                organization_id: 3,
                external_id: '101',
                name: 'sentry',
                owner: 'getsentry',
                provider: 'github',
                branch_name: 'develop',
                instructions: 'Use Conventional Commits',
                integration_id: '201',
                branch_overrides: [],
              },
            ],
          }),
        })
      );
    });
    expect(seerPreferencesPostRequest).toHaveBeenCalledTimes(1);
  });

  it('can remove a repository', async () => {
    const seerPreferencesPostRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'POST',
    });

    render(<ProjectSeer />, {
      organization,
      outletContext: {project},
    });
    renderGlobalModal();

    const repoItem = await screen.findByText('getsentry/sentry');

    // Open the row and click remove
    await userEvent.click(repoItem);
    await userEvent.click(screen.getByRole('button', {name: 'Remove Repository'}));

    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    // Wait for the repo to disappear
    await waitFor(() => {
      expect(screen.queryByText('getsentry/sentry')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            automated_run_stopping_point: 'root_cause',
            repositories: [],
          }),
        })
      );
    });
    expect(seerPreferencesPostRequest).toHaveBeenCalledTimes(1);
  });

  it('can update the autofix autorun threshold setting', async () => {
    const initialProject: Project = {
      ...project,
      autofixAutomationTuning: 'high', // Start from high
      seerScannerAutomation: true,
    };

    const projectPutRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: {
        autofixAutomationTuning: 'high',
      },
    });

    render(<ProjectSeer />, {
      organization,
      outletContext: {project: initialProject},
    });

    // Find the select menu
    const select = await screen.findByRole('textbox', {
      name: /Auto-Trigger Fixes/i,
    });

    act(() => {
      select.focus();
    });

    // Open the menu and select a new value
    await userEvent.click(select);

    const options = await screen.findAllByText('Minimally Actionable and Above');
    expect(options[0]).toBeDefined();
    if (options[0]) {
      await userEvent.click(options[0]);
    }

    // Reopen the menu to select another value
    await userEvent.click(select);

    const options2 = await screen.findAllByText('Highly Actionable and Above');
    expect(options2[0]).toBeDefined();
    if (options2[0]) {
      await userEvent.click(options2[0]);
    }

    // Form has saveOnBlur=true, so wait for the PUT request
    await waitFor(() => {
      expect(projectPutRequest).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(projectPutRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({data: {autofixAutomationTuning: 'low'}})
      );
    });
  });

  it('can update the project scanner automation setting', async () => {
    const initialProject: Project = {
      ...project,
      seerScannerAutomation: false, // Start from off
    };

    const projectPutRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: {},
    });

    render(<ProjectSeer />, {
      organization,
      outletContext: {project: initialProject},
    });

    // Find the toggle for Automate Issue Scans
    const toggle = await screen.findByRole('checkbox', {
      name: /Scan Issues/i,
    });
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeChecked();

    // Toggle it on
    await userEvent.click(toggle);

    // Form has saveOnBlur=true, so wait for the PUT request
    await waitFor(() => {
      expect(projectPutRequest).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(projectPutRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({data: {seerScannerAutomation: true}})
      );
    });
  });

  it('can update the automation stopping point setting', async () => {
    const initialProject: Project = {
      ...project,
      autofixAutomationTuning: 'medium',
      seerScannerAutomation: true,
    };

    const projectPutRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: {},
    });

    const seerPreferencesPostRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'POST',
    });

    render(<ProjectSeer />, {
      organization,
      outletContext: {project: initialProject},
    });

    // Find the select menu for Where should Seer stop?
    const select = await screen.findByRole('textbox', {
      name: /Where should Seer stop/i,
    });

    act(() => {
      select.focus();
    });

    // Open the menu and select a new value (e.g., 'Code Changes')
    await userEvent.click(select);
    const option = await screen.findByText('Code Changes');
    await userEvent.click(option);

    // Form has saveOnBlur=true, so wait for the PUT request
    await waitFor(() => {
      expect(projectPutRequest).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(projectPutRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({data: {automated_run_stopping_point: 'code_changes'}})
      );
    });

    // Also check that the seer preferences POST was called with the new stopping point
    await waitFor(() => {
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            automated_run_stopping_point: 'code_changes',
            repositories: expect.any(Array),
          }),
        })
      );
    });
  });

  it('can enable automation handoff to Cursor when Cursor integration is available', async () => {
    const orgWithCursorFeature = OrganizationFixture({
      features: ['autofix-seer-preferences', 'integrations-cursor'],
    });

    const initialProject: Project = {
      ...project,
      autofixAutomationTuning: 'medium',
      seerScannerAutomation: true,
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${orgWithCursorFeature.slug}/seer/setup-check/`,
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
      url: `/organizations/${orgWithCursorFeature.slug}/repos/`,
      query: {status: 'active'},
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${orgWithCursorFeature.slug}/${project.slug}/`,
      method: 'GET',
      body: initialProject,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${orgWithCursorFeature.slug}/${project.slug}/seer/preferences/`,
      method: 'GET',
      body: {
        code_mapping_repos: [],
        repositories: [],
        automated_run_stopping_point: 'root_cause',
      },
    });

    // Mock the coding agent integrations endpoint with a Cursor integration
    MockApiClient.addMockResponse({
      url: `/organizations/${orgWithCursorFeature.slug}/integrations/coding-agents/`,
      method: 'GET',
      body: {
        integrations: [
          {
            id: '123',
            name: 'Cursor',
            provider: 'cursor',
          },
        ],
      },
    });

    const projectPutRequest = MockApiClient.addMockResponse({
      url: `/projects/${orgWithCursorFeature.slug}/${project.slug}/`,
      method: 'PUT',
      body: {},
    });

    const seerPreferencesPostRequest = MockApiClient.addMockResponse({
      url: `/projects/${orgWithCursorFeature.slug}/${project.slug}/seer/preferences/`,
      method: 'POST',
    });

    render(<ProjectSeer />, {
      organization: orgWithCursorFeature,
      outletContext: {project: initialProject},
    });

    // Find the select menu for Where should Seer stop?
    const select = await screen.findByRole('textbox', {
      name: /Where should Seer stop/i,
    });

    act(() => {
      select.focus();
    });

    // Open the menu and select 'Hand off to Cursor Cloud Agent'
    await userEvent.click(select);
    const cursorOption = await screen.findByText('Hand off to Cursor Cloud Agent');
    await userEvent.click(cursorOption);

    // Form has saveOnBlur=true, so wait for the PUT request
    await waitFor(() => {
      expect(projectPutRequest).toHaveBeenCalledTimes(1);
    });

    // Wait for the seer preferences POST to be called with automation_handoff
    await waitFor(() => {
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            automated_run_stopping_point: 'root_cause',
            repositories: expect.any(Array),
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent',
              integration_id: 123,
            },
          }),
        })
      );
    });
  });

  it('hides Scan Issues toggle when triage-signals-v0 feature flag is enabled', async () => {
    const projectWithFeatureFlag = ProjectFixture({
      features: ['triage-signals-v0'],
    });

    render(<ProjectSeer />, {
      organization,
      outletContext: {project: projectWithFeatureFlag},
    });

    // Wait for the page to load
    await screen.findByText(/Automation/i);

    // The Scan Issues toggle should NOT be visible
    expect(
      screen.queryByRole('checkbox', {
        name: /Scan Issues/i,
      })
    ).not.toBeInTheDocument();
  });

  it('shows Scan Issues toggle when triage-signals-v0 feature flag is disabled', async () => {
    render(<ProjectSeer />, {
      organization,
      outletContext: {project},
    });

    // The Scan Issues toggle should be visible
    const toggle = await screen.findByRole('checkbox', {
      name: /Scan Issues/i,
    });
    expect(toggle).toBeInTheDocument();
  });
});
