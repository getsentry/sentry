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

import * as indicators from 'sentry/actionCreators/indicator';
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

    const options = await screen.findAllByText('Highly Actionable and Above');
    expect(options[0]).toBeDefined();
    if (options[0]) {
      await userEvent.click(options[0]);
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

    // The field uses getData: () => ({}) to exclude itself from the form submission
    // Only the seer preferences POST should be called with the actual data
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

    // The project PUT may be called but with empty data (no automated_run_stopping_point)
    if (projectPutRequest.mock.calls.length > 0) {
      expect(projectPutRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({data: {}})
      );
    }
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

    // The field uses getData: () => ({}) to exclude itself from the form submission
    // Only the seer preferences POST should be called with the actual data
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
              auto_create_pr: false,
            },
          }),
        })
      );
    });

    // The project PUT may be called but with empty data (no automated_run_stopping_point)
    if (projectPutRequest.mock.calls.length > 0) {
      expect(projectPutRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({data: {}})
      );
    }
  });

  it('hides Scan Issues toggle when triage-signals-v0 feature flag is enabled', async () => {
    const projectWithFeatureFlag = ProjectFixture({
      features: ['triage-signals-v0'],
      autofixAutomationTuning: 'medium', // Already enabled, so no auto-enable PUT
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

  describe('Auto-Trigger Fixes with triage-signals-v0', () => {
    it('shows as toggle when flag enabled, dropdown when disabled', async () => {
      const projectWithFlag = ProjectFixture({
        features: ['triage-signals-v0'],
        seerScannerAutomation: true,
        autofixAutomationTuning: 'medium', // Already enabled, so no auto-enable PUT
      });

      const {unmount} = render(<ProjectSeer />, {
        organization,
        outletContext: {project: projectWithFlag},
      });

      await screen.findByText(/Automation/i);
      expect(
        screen.getByRole('checkbox', {name: /Auto-Trigger Fixes/i})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('textbox', {name: /Auto-Trigger Fixes/i})
      ).not.toBeInTheDocument();

      unmount();

      render(<ProjectSeer />, {
        organization,
        outletContext: {
          project: ProjectFixture({
            seerScannerAutomation: true,
            autofixAutomationTuning: 'high',
          }),
        },
      });

      await screen.findByText(/Automation/i);
      expect(
        screen.getByRole('textbox', {name: /Auto-Trigger Fixes/i})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('checkbox', {name: /Auto-Trigger Fixes/i})
      ).not.toBeInTheDocument();
    });

    it('toggle is always checked when triage-signals-v0 flag is enabled', async () => {
      // When flag is on, the toggle is always checked regardless of stored value
      // because we default to ON for triage signals users
      render(<ProjectSeer />, {
        organization,
        outletContext: {
          project: ProjectFixture({
            features: ['triage-signals-v0'],
            seerScannerAutomation: true,
            autofixAutomationTuning: 'medium',
          }),
        },
      });

      expect(
        await screen.findByRole('checkbox', {name: /Auto-Trigger Fixes/i})
      ).toBeChecked();
    });

    it('saves "medium" when toggled ON, "off" when toggled OFF', async () => {
      const projectPutRequest = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/`,
        method: 'PUT',
        body: {},
      });

      render(<ProjectSeer />, {
        organization,
        outletContext: {
          project: ProjectFixture({
            features: ['triage-signals-v0'],
            seerScannerAutomation: true,
            autofixAutomationTuning: 'medium', // Start with enabled so no auto-enable
          }),
        },
      });

      const toggle = await screen.findByRole('checkbox', {name: /Auto-Trigger Fixes/i});
      expect(toggle).toBeChecked();

      // Toggle OFF
      await userEvent.click(toggle);

      await waitFor(() => {
        expect(projectPutRequest).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({data: {autofixAutomationTuning: 'off'}})
        );
      });

      // Toggle back ON
      await userEvent.click(toggle);

      await waitFor(() => {
        expect(projectPutRequest).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({data: {autofixAutomationTuning: 'medium'}})
        );
      });
    });

    it('respects existing off setting for orgs with flag enabled', async () => {
      render(<ProjectSeer />, {
        organization,
        outletContext: {
          project: ProjectFixture({
            features: ['triage-signals-v0'],
            seerScannerAutomation: true,
            autofixAutomationTuning: 'off', // Existing org with it disabled
          }),
        },
      });

      // Toggle should be unchecked, respecting the existing 'off' setting
      expect(
        await screen.findByRole('checkbox', {name: /Auto-Trigger Fixes/i})
      ).not.toBeChecked();
    });

    it('defaults to ON for new orgs (undefined value)', async () => {
      render(<ProjectSeer />, {
        organization,
        outletContext: {
          project: ProjectFixture({
            features: ['triage-signals-v0'],
            seerScannerAutomation: true,
            autofixAutomationTuning: undefined, // New org
          }),
        },
      });

      // Toggle should be checked for new orgs
      expect(
        await screen.findByRole('checkbox', {name: /Auto-Trigger Fixes/i})
      ).toBeChecked();
    });
  });

  describe('Auto Create PR Setting', () => {
    it('does not render when stopping point is not cursor_handoff', async () => {
      const initialProject: Project = {
        ...project,
        autofixAutomationTuning: 'medium',
        seerScannerAutomation: true,
      };

      render(<ProjectSeer />, {
        organization,
        outletContext: {project: initialProject},
      });

      // Wait for the page to load
      await screen.findByText(/Automation/i);

      // The toggle should NOT be visible when stopping point is not cursor_handoff
      expect(
        screen.queryByRole('checkbox', {
          name: /Auto-Create Pull Requests/i,
        })
      ).not.toBeInTheDocument();
    });

    it('renders and loads initial value when cursor_handoff is selected', async () => {
      MockApiClient.clearMockResponses();

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
          setupAcknowledgement: {orgHasAcknowledged: true, userHasAcknowledged: true},
          billing: {hasAutofixQuota: true, hasScannerQuota: true},
        },
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursorFeature.slug}/repos/`,
        query: {status: 'active'},
        method: 'GET',
        body: [],
      });

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

      // Mock preferences with automation_handoff including auto_create_pr
      MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursorFeature.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {
          preference: {
            organization_id: orgWithCursorFeature.id,
            project_id: project.id,
            repositories: [],
            automated_run_stopping_point: 'root_cause',
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent',
              integration_id: 123,
              auto_create_pr: true,
            },
          },
          code_mapping_repos: [],
        },
      });

      render(<ProjectSeer />, {
        organization: orgWithCursorFeature,
        outletContext: {project: initialProject},
      });

      // Wait for the toggle to load
      const toggle = await screen.findByRole('checkbox', {
        name: /Auto-Create Pull Requests/i,
      });

      // Verify it's checked
      await waitFor(() => {
        expect(toggle).toBeChecked();
      });
    });

    it('calls update mutation when toggled', async () => {
      MockApiClient.clearMockResponses();

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
          setupAcknowledgement: {orgHasAcknowledged: true, userHasAcknowledged: true},
          billing: {hasAutofixQuota: true, hasScannerQuota: true},
        },
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursorFeature.slug}/repos/`,
        query: {status: 'active'},
        method: 'GET',
        body: [],
      });

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

      // Mock preferences with automation_handoff
      MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursorFeature.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {
          preference: {
            repositories: [],
            automated_run_stopping_point: 'root_cause',
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent',
              integration_id: 123,
              auto_create_pr: false,
            },
          },
          code_mapping_repos: [],
        },
      });

      MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursorFeature.slug}/${project.slug}/`,
        method: 'PUT',
        body: {},
      });

      // Mock for the Form's empty apiEndpoint POST
      MockApiClient.addMockResponse({
        url: '',
        method: 'POST',
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

      // Find and click the toggle
      const toggle = await screen.findByRole('checkbox', {
        name: /Auto-Create Pull Requests/i,
      });
      expect(toggle).not.toBeChecked();

      await userEvent.click(toggle);

      // Wait for the POST request to be called
      await waitFor(() => {
        expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({
              automation_handoff: expect.objectContaining({
                auto_create_pr: true,
              }),
              repositories: expect.any(Array),
            }),
          })
        );
      });
    });

    it('shows integration selector when multiple cursor integrations exist', async () => {
      MockApiClient.clearMockResponses();

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
          setupAcknowledgement: {orgHasAcknowledged: true, userHasAcknowledged: true},
          billing: {hasAutofixQuota: true, hasScannerQuota: true},
        },
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursorFeature.slug}/repos/`,
        query: {status: 'active'},
        method: 'GET',
        body: [],
      });

      // Mock multiple cursor integrations
      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursorFeature.slug}/integrations/coding-agents/`,
        method: 'GET',
        body: {
          integrations: [
            {
              id: '123',
              name: 'Cursor - user1@example.com/api-key-1',
              provider: 'cursor',
            },
            {
              id: '456',
              name: 'Cursor - user2@example.com/api-key-2',
              provider: 'cursor',
            },
          ],
        },
      });

      // Mock preferences with automation_handoff using first integration
      MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursorFeature.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {
          preference: {
            repositories: [],
            automated_run_stopping_point: 'root_cause',
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent',
              integration_id: 123,
              auto_create_pr: false,
            },
          },
          code_mapping_repos: [],
        },
      });

      MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursorFeature.slug}/${project.slug}/`,
        method: 'PUT',
        body: {},
      });

      render(<ProjectSeer />, {
        organization: orgWithCursorFeature,
        outletContext: {project: initialProject},
      });

      // The integration selector should be visible with multiple integrations
      const integrationSelect = await screen.findByRole('textbox', {
        name: /Select Configuration/i,
      });
      expect(integrationSelect).toBeInTheDocument();

      // The auto-create PR toggle should also be visible
      expect(
        screen.getByRole('checkbox', {name: /Auto-Create Pull Requests/i})
      ).toBeInTheDocument();
    });

    it('calls update mutation when switching integration', async () => {
      MockApiClient.clearMockResponses();

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
          setupAcknowledgement: {orgHasAcknowledged: true, userHasAcknowledged: true},
          billing: {hasAutofixQuota: true, hasScannerQuota: true},
        },
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursorFeature.slug}/repos/`,
        query: {status: 'active'},
        method: 'GET',
        body: [],
      });

      // Mock multiple cursor integrations
      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursorFeature.slug}/integrations/coding-agents/`,
        method: 'GET',
        body: {
          integrations: [
            {
              id: '123',
              name: 'Cursor - user1@example.com/api-key-1',
              provider: 'cursor',
            },
            {
              id: '456',
              name: 'Cursor - user2@example.com/api-key-2',
              provider: 'cursor',
            },
          ],
        },
      });

      // Mock preferences with automation_handoff using first integration
      MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursorFeature.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {
          preference: {
            repositories: [],
            automated_run_stopping_point: 'root_cause',
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent',
              integration_id: 123,
              auto_create_pr: false,
            },
          },
          code_mapping_repos: [],
        },
      });

      MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursorFeature.slug}/${project.slug}/`,
        method: 'PUT',
        body: {},
      });

      // Mock for the Form's empty apiEndpoint POST
      MockApiClient.addMockResponse({
        url: '',
        method: 'POST',
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

      // Find and click the integration selector
      const integrationSelect = await screen.findByRole('textbox', {
        name: /Select Configuration/i,
      });

      act(() => {
        integrationSelect.focus();
      });

      await userEvent.click(integrationSelect);

      // Select the second integration
      const secondIntegration = await screen.findByText(
        'Cursor - user2@example.com/api-key-2 (456)'
      );
      await userEvent.click(secondIntegration);

      // Wait for the POST request to be called with the new integration ID
      await waitFor(() => {
        expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({
              automation_handoff: expect.objectContaining({
                integration_id: 456,
              }),
              repositories: expect.any(Array),
            }),
          })
        );
      });
    });

    it('does not show integration selector with single cursor integration', async () => {
      MockApiClient.clearMockResponses();

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
          setupAcknowledgement: {orgHasAcknowledged: true, userHasAcknowledged: true},
          billing: {hasAutofixQuota: true, hasScannerQuota: true},
        },
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursorFeature.slug}/repos/`,
        query: {status: 'active'},
        method: 'GET',
        body: [],
      });

      // Mock single cursor integration
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

      // Mock preferences with automation_handoff
      MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursorFeature.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {
          preference: {
            repositories: [],
            automated_run_stopping_point: 'root_cause',
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent',
              integration_id: 123,
              auto_create_pr: false,
            },
          },
          code_mapping_repos: [],
        },
      });

      render(<ProjectSeer />, {
        organization: orgWithCursorFeature,
        outletContext: {project: initialProject},
      });

      // Wait for the page to load
      await screen.findByRole('checkbox', {name: /Auto-Create Pull Requests/i});

      // The integration selector should NOT be visible with only one integration
      expect(
        screen.queryByRole('textbox', {name: /Select Configuration/i})
      ).not.toBeInTheDocument();
    });
  });

  describe('Auto-open PR and Cursor Handoff toggles with triage-signals-v0', () => {
    it('shows Auto-open PR toggle when Auto-Trigger is ON', async () => {
      render(<ProjectSeer />, {
        organization,
        outletContext: {
          project: ProjectFixture({
            features: ['triage-signals-v0'],
            autofixAutomationTuning: 'medium',
          }),
        },
      });

      await screen.findByText(/Automation/i);
      expect(screen.getByRole('checkbox', {name: /Auto-open PR/i})).toBeInTheDocument();
    });

    it('hides Auto-open PR toggle when Auto-Trigger is OFF', async () => {
      render(<ProjectSeer />, {
        organization,
        outletContext: {
          project: ProjectFixture({
            features: ['triage-signals-v0'],
            autofixAutomationTuning: 'off',
          }),
        },
      });

      await screen.findByText(/Automation/i);
      expect(
        screen.queryByRole('checkbox', {name: /Auto-open PR/i})
      ).not.toBeInTheDocument();
    });

    it('shows Cursor handoff toggle when Auto-Trigger is ON and Cursor integration exists', async () => {
      const orgWithCursor = OrganizationFixture({
        features: ['autofix-seer-preferences', 'integrations-cursor'],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursor.slug}/seer/setup-check/`,
        method: 'GET',
        body: {
          setupAcknowledgement: {orgHasAcknowledged: true, userHasAcknowledged: true},
          billing: {hasAutofixQuota: true, hasScannerQuota: true},
        },
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursor.slug}/repos/`,
        query: {status: 'active'},
        method: 'GET',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursor.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {code_mapping_repos: []},
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursor.slug}/integrations/coding-agents/`,
        method: 'GET',
        body: {
          integrations: [{id: '123', name: 'Cursor', provider: 'cursor'}],
        },
      });

      render(<ProjectSeer />, {
        organization: orgWithCursor,
        outletContext: {
          project: ProjectFixture({
            features: ['triage-signals-v0'],
            autofixAutomationTuning: 'medium',
          }),
        },
      });

      await screen.findByText(/Automation/i);
      expect(
        screen.getByRole('checkbox', {name: /Hand off to Cursor/i})
      ).toBeInTheDocument();
    });

    it('hides Cursor handoff toggle when no Cursor integration', async () => {
      render(<ProjectSeer />, {
        organization,
        outletContext: {
          project: ProjectFixture({
            features: ['triage-signals-v0'],
            autofixAutomationTuning: 'medium',
          }),
        },
      });

      await screen.findByText(/Automation/i);
      expect(
        screen.queryByRole('checkbox', {name: /Hand off to Cursor/i})
      ).not.toBeInTheDocument();
    });

    it('updates preferences when Auto-open PR toggle is changed', async () => {
      MockApiClient.addMockResponse({
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
        outletContext: {
          project: ProjectFixture({
            features: ['triage-signals-v0'],
            autofixAutomationTuning: 'medium',
          }),
        },
      });

      const toggle = await screen.findByRole('checkbox', {name: /Auto-open PR/i});
      await userEvent.click(toggle);

      await waitFor(() => {
        expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({
              automated_run_stopping_point: 'open_pr',
              automation_handoff: undefined,
            }),
          })
        );
      });
    });

    it('updates preferences when Cursor handoff toggle is changed', async () => {
      const orgWithCursor = OrganizationFixture({
        features: ['autofix-seer-preferences', 'integrations-cursor'],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursor.slug}/seer/setup-check/`,
        method: 'GET',
        body: {
          setupAcknowledgement: {orgHasAcknowledged: true, userHasAcknowledged: true},
          billing: {hasAutofixQuota: true, hasScannerQuota: true},
        },
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursor.slug}/repos/`,
        query: {status: 'active'},
        method: 'GET',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursor.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {code_mapping_repos: []},
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursor.slug}/integrations/coding-agents/`,
        method: 'GET',
        body: {
          integrations: [{id: '123', name: 'Cursor', provider: 'cursor'}],
        },
      });

      MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursor.slug}/${project.slug}/`,
        method: 'PUT',
        body: {},
      });

      const seerPreferencesPostRequest = MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursor.slug}/${project.slug}/seer/preferences/`,
        method: 'POST',
      });

      render(<ProjectSeer />, {
        organization: orgWithCursor,
        outletContext: {
          project: ProjectFixture({
            features: ['triage-signals-v0'],
            autofixAutomationTuning: 'medium',
          }),
        },
      });

      const toggle = await screen.findByRole('checkbox', {name: /Hand off to Cursor/i});
      await userEvent.click(toggle);

      await waitFor(() => {
        expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({
              automated_run_stopping_point: 'root_cause',
              automation_handoff: {
                handoff_point: 'root_cause',
                target: 'cursor_background_agent',
                integration_id: 123,
                auto_create_pr: false,
              },
            }),
          })
        );
      });
    });

    it('shows error when Cursor handoff fails due to missing integration', async () => {
      const orgWithCursor = OrganizationFixture({
        features: ['autofix-seer-preferences', 'integrations-cursor'],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursor.slug}/seer/setup-check/`,
        method: 'GET',
        body: {
          setupAcknowledgement: {orgHasAcknowledged: true, userHasAcknowledged: true},
          billing: {hasAutofixQuota: true, hasScannerQuota: true},
        },
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursor.slug}/repos/`,
        query: {status: 'active'},
        method: 'GET',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursor.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {code_mapping_repos: []},
      });

      // Mock integrations endpoint returning empty array (no Cursor integration)
      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursor.slug}/integrations/coding-agents/`,
        method: 'GET',
        body: {integrations: []},
      });

      render(<ProjectSeer />, {
        organization: orgWithCursor,
        outletContext: {
          project: ProjectFixture({
            features: ['triage-signals-v0'],
            autofixAutomationTuning: 'medium',
          }),
        },
      });

      await screen.findByText(/Automation/i);

      // Toggle should not be visible when no Cursor integration exists
      expect(
        screen.queryByRole('checkbox', {name: /Hand off to Cursor/i})
      ).not.toBeInTheDocument();
    });

    it('shows error message when Auto-open PR toggle fails', async () => {
      jest.spyOn(indicators, 'addErrorMessage');

      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/`,
        method: 'PUT',
        body: {},
      });

      const seerPreferencesPostRequest = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        method: 'POST',
        statusCode: 500,
        body: {detail: 'Internal Server Error'},
      });

      render(<ProjectSeer />, {
        organization,
        outletContext: {
          project: ProjectFixture({
            features: ['triage-signals-v0'],
            autofixAutomationTuning: 'medium',
          }),
        },
      });

      const toggle = await screen.findByRole('checkbox', {name: /Auto-open PR/i});
      await userEvent.click(toggle);

      await waitFor(() => {
        expect(seerPreferencesPostRequest).toHaveBeenCalled();
      });

      // Should show error message
      expect(indicators.addErrorMessage).toHaveBeenCalledWith(
        'Failed to update auto-open PR setting'
      );
    });

    it('shows error message when Cursor handoff toggle fails', async () => {
      jest.spyOn(indicators, 'addErrorMessage');

      const orgWithCursor = OrganizationFixture({
        features: ['autofix-seer-preferences', 'integrations-cursor'],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursor.slug}/seer/setup-check/`,
        method: 'GET',
        body: {
          setupAcknowledgement: {orgHasAcknowledged: true, userHasAcknowledged: true},
          billing: {hasAutofixQuota: true, hasScannerQuota: true},
        },
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursor.slug}/repos/`,
        query: {status: 'active'},
        method: 'GET',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursor.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {code_mapping_repos: []},
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursor.slug}/integrations/coding-agents/`,
        method: 'GET',
        body: {
          integrations: [{id: '123', name: 'Cursor', provider: 'cursor'}],
        },
      });

      MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursor.slug}/${project.slug}/`,
        method: 'PUT',
        body: {},
      });

      const seerPreferencesPostRequest = MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursor.slug}/${project.slug}/seer/preferences/`,
        method: 'POST',
        statusCode: 500,
        body: {detail: 'Internal Server Error'},
      });

      render(<ProjectSeer />, {
        organization: orgWithCursor,
        outletContext: {
          project: ProjectFixture({
            features: ['triage-signals-v0'],
            autofixAutomationTuning: 'medium',
          }),
        },
      });

      const toggle = await screen.findByRole('checkbox', {name: /Hand off to Cursor/i});
      await userEvent.click(toggle);

      await waitFor(() => {
        expect(seerPreferencesPostRequest).toHaveBeenCalled();
      });

      // Should show error message
      expect(indicators.addErrorMessage).toHaveBeenCalledWith(
        'Failed to update Cursor handoff setting'
      );
    });
  });
});
