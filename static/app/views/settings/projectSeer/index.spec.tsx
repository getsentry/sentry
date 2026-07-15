import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture} from 'sentry-fixture/project';
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
import {CodingAgentProvider} from 'sentry/components/events/autofix/types';
import type {Organization} from 'sentry/types/organization';
import type {DetailedProject} from 'sentry/types/project';
import {mockElementSize} from 'sentry/utils/fixtures/virtualization';
import {ProjectSeerContainer as ProjectSeer} from 'sentry/views/settings/projectSeer';

mockElementSize({width: 0, height: 30});

describe('ProjectSeer', () => {
  let project: DetailedProject;
  let organization: Organization;

  // The coding-agent CTAs fetch the per-project seer setting to decide whether
  // handoff is already configured. Only fires once an integration exists, so
  // tests that mock a coding-agent integration also need this GET mocked.
  const mockSeerSettingsGet = (orgSlug: string) =>
    MockApiClient.addMockResponse({
      url: `/projects/${orgSlug}/${project.slug}/seer/settings/`,
      method: 'GET',
      body: {
        projectId: project.id,
        projectSlug: project.slug,
        agent: 'seer',
        integrationId: null,
        stoppingPoint: 'root_cause',
        autoCreatePr: null,
        automationTuning: 'off',
        scannerAutomation: false,
        reposCount: 1,
      },
    });

  beforeEach(() => {
    project = DetailedProjectFixture();
    organization = OrganizationFixture();
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/`,
      body: project,
    });

    // Mock the seer setup check endpoint
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/setup-check/`,
      method: 'GET',
      body: {
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
      preference: {
        repositories: [
          {
            organization_id: 3,
            external_id: '101',
            name: 'sentry',
            owner: 'getsentry',
            provider: 'github',
            integration_id: '201',
            branch_name: '',
            instructions: '',
            branch_overrides: [],
          },
        ],
        automated_run_stopping_point: 'root_cause',
      },
    };

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'GET',
      body: seerPreferencesResponse,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/projects/`,
      method: 'GET',
      body: [
        {
          projectId: project.id,
          projectSlug: project.slug,
          agent: 'seer',
          integrationId: null,
          stoppingPoint: 'root_cause',
          autoCreatePr: null,
          automationTuning: 'off',
          scannerAutomation: false,
          reposCount: 1,
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      method: 'GET',
      body: {
        integrations: [],
      },
    });

    mockSeerSettingsGet(organization.slug);

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
      method: 'GET',
      body: [
        {
          id: '1',
          repositoryId: '1',
          branchName: '',
          branchOverrides: [],
          instructions: '',
          externalId: '101',
          integrationId: '201',
          name: 'sentry',
          organizationId: '',
          owner: 'getsentry',
          provider: 'github',
        },
      ],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('can add a repository', async () => {
    const seerReposPostRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
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
    await userEvent.click(
      screen.getByRole('button', {name: 'Add Repositories to Project'})
    );

    // Find and select the unselected repo in the modal
    const modal = await screen.findByRole('dialog');
    await userEvent.click(
      await within(modal).findByRole('button', {name: /getsentry\/seer/})
    );

    // Override GET mock to return updated data before mutation triggers refetch
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
      method: 'GET',
      body: [
        {
          id: '1',
          repositoryId: '1',
          branchName: '',
          branchOverrides: [],
          instructions: '',
          externalId: '101',
          integrationId: '201',
          name: 'sentry',
          organizationId: '',
          owner: 'getsentry',
          provider: 'github',
        },
        {
          id: '2',
          repositoryId: '2',
          branchName: '',
          branchOverrides: [],
          instructions: '',
          externalId: '102',
          integrationId: '202',
          name: 'seer',
          organizationId: '',
          owner: 'getsentry',
          provider: 'github',
        },
      ],
    });

    // Save changes in the modal
    await userEvent.click(within(modal).getByRole('button', {name: 'Add 1 Repository'}));

    // Wait for modal to close and repo list to update
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('getsentry/seer')).toBeInTheDocument();

    await waitFor(() => {
      expect(seerReposPostRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            repos: [
              expect.objectContaining({
                repositoryId: '2',
              }),
            ],
          }),
        })
      );
    });
    expect(seerReposPostRequest).toHaveBeenCalledTimes(1);
  });

  it('can update repository settings', async () => {
    const seerRepoPutRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/1/`,
      method: 'PUT',
    });

    render(<ProjectSeer />, {
      organization,
      outletContext: {project},
    });
    renderGlobalModal();

    const repoItem = await screen.findByText('getsentry/sentry');

    // Expand the repo item
    await userEvent.click(repoItem);

    // Find input field and type a branch name (auto-saves via debounce)
    const branchInput = screen.getByPlaceholderText('Default branch');
    await userEvent.type(branchInput, 'develop');
    await userEvent.tab(); // blur triggers AutoSaveForm submit

    await waitFor(() => {
      expect(seerRepoPutRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            branchName: 'develop',
          }),
        })
      );
    });
  });

  it('can remove a repository', async () => {
    const seerRepoDeleteRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/1/`,
      method: 'DELETE',
    });

    render(<ProjectSeer />, {
      organization,
      outletContext: {project},
    });
    renderGlobalModal();

    const repoItem = await screen.findByText('getsentry/sentry');

    // Open the row and click remove
    await userEvent.click(repoItem);

    // Override GET mock to return empty list after deletion
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
      method: 'GET',
      body: [],
    });

    await userEvent.click(screen.getByRole('button', {name: 'Disconnect Repository'}));

    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    // Wait for the repo to disappear
    await waitFor(() => {
      expect(screen.queryByText('getsentry/sentry')).not.toBeInTheDocument();
    });

    expect(seerRepoDeleteRequest).toHaveBeenCalledTimes(1);
  });

  it('can update the autofix autorun threshold setting', async () => {
    const initialProject: DetailedProject = {
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
    const initialProject: DetailedProject = {
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
    const initialProject: DetailedProject = {
      ...project,
      autofixAutomationTuning: 'medium',
      seerScannerAutomation: true,
    };

    const projectPutRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: {},
    });

    const seerSettingsPutRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      method: 'PUT',
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

    // The field uses getData: () => ({}) to exclude itself from the form submission.
    // Settings changes now go through the dedicated seer/settings/ endpoint, not
    // seer/preferences/, so no repository payload is involved.
    await waitFor(() => {
      expect(seerSettingsPutRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            agent: 'seer',
            stoppingPoint: 'code_changes',
            automationTuning: 'medium',
          },
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

  // Regression test for the removed `key` remount: the stopping-point field's
  // initialValue depends on the seer settings infinite query, which resolves
  // after mount. The select must reflect a loaded handoff without interaction —
  // TanStack re-seeds the untouched field once the async value arrives.
  it('reflects a handoff loaded after mount without interaction', async () => {
    MockApiClient.clearMockResponses();

    const org = OrganizationFixture({features: []});
    const initialProject: DetailedProject = {
      ...project,
      autofixAutomationTuning: 'medium',
      seerScannerAutomation: true,
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/seer/projects/`,
      method: 'GET',
      body: [
        {
          projectId: project.id,
          projectSlug: project.slug,
          agent: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
          integrationId: '123',
          stoppingPoint: 'root_cause',
          autoCreatePr: false,
          automationTuning: 'medium',
          scannerAutomation: true,
          reposCount: 0,
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      body: initialProject,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/seer/repos/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/seer/setup-check/`,
      method: 'GET',
      body: {billing: {hasAutofixQuota: true, hasScannerQuota: true}},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/repos/`,
      query: {status: 'active'},
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/coding-agents/`,
      method: 'GET',
      body: {integrations: [{id: '123', name: 'Cursor', provider: 'cursor'}]},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/seer/preferences/`,
      method: 'GET',
      body: {
        preference: {
          repositories: [],
          automated_run_stopping_point: 'root_cause',
          automation_handoff: {
            handoff_point: 'root_cause',
            target: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
            integration_id: 123,
            auto_create_pr: false,
          },
        },
        code_mapping_repos: [],
      },
    });
    mockSeerSettingsGet(org.slug);

    render(<ProjectSeer />, {
      organization: org,
      outletContext: {project: initialProject},
    });

    // The loaded handoff shows without any user interaction...
    expect(await screen.findByText('Hand off to Cursor Cloud Agent')).toBeInTheDocument();
    // ...and the field is not stuck on the pre-load default.
    expect(screen.queryByText('Root Cause (default)')).not.toBeInTheDocument();
  });

  it('can enable automation handoff to Cursor when Cursor integration is available', async () => {
    const orgWithCursorFeature = OrganizationFixture({
      features: [],
    });

    const initialProject: DetailedProject = {
      ...project,
      autofixAutomationTuning: 'medium',
      seerScannerAutomation: true,
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${orgWithCursorFeature.slug}/seer/setup-check/`,
      method: 'GET',
      body: {
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

    const seerSettingsPutRequest = MockApiClient.addMockResponse({
      url: `/projects/${orgWithCursorFeature.slug}/${project.slug}/seer/settings/`,
      method: 'PUT',
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

    await waitFor(() => {
      expect(seerSettingsPutRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            agent: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
            integrationId: '123',
            stoppingPoint: 'root_cause',
            autoCreatePr: false,
            automationTuning: 'medium',
          },
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

  it('can enable automation handoff to Claude when Claude integration is available', async () => {
    const initialProject: DetailedProject = {
      ...project,
      autofixAutomationTuning: 'medium',
      seerScannerAutomation: true,
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/setup-check/`,
      method: 'GET',
      body: {
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
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'GET',
      body: initialProject,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'GET',
      body: {
        code_mapping_repos: [],
        repositories: [],
        automated_run_stopping_point: 'root_cause',
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      method: 'GET',
      body: {
        integrations: [
          {
            id: '456',
            name: 'Claude',
            provider: 'claude_code',
          },
        ],
      },
    });

    const projectPutRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: {},
    });

    const seerSettingsPutRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      method: 'PUT',
    });

    render(<ProjectSeer />, {
      organization,
      outletContext: {project: initialProject},
    });

    const select = await screen.findByRole('textbox', {
      name: /Where should Seer stop/i,
    });

    act(() => {
      select.focus();
    });

    await userEvent.click(select);
    const claudeOption = await screen.findByText('Hand off to Claude Agent');
    await userEvent.click(claudeOption);

    await waitFor(() => {
      expect(seerSettingsPutRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            agent: CodingAgentProvider.CLAUDE_CODE_AGENT,
            integrationId: '456',
            stoppingPoint: 'root_cause',
            autoCreatePr: false,
            automationTuning: 'medium',
          },
        })
      );
    });

    if (projectPutRequest.mock.calls.length > 0) {
      expect(projectPutRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({data: {}})
      );
    }
  });

  describe('Auto Create PR Setting', () => {
    it('does not render when stopping point is not cursor_handoff', async () => {
      const initialProject: DetailedProject = {
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

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/projects/`,
        method: 'GET',
        body: [
          {
            projectId: project.id,
            projectSlug: project.slug,
            agent: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
            integrationId: '123',
            stoppingPoint: 'root_cause',
            autoCreatePr: true,
            automationTuning: 'medium',
            scannerAutomation: true,
            reposCount: 0,
          },
        ],
      });

      const orgWithCursorFeature = OrganizationFixture({
        features: [],
      });

      const initialProject: DetailedProject = {
        ...project,
        autofixAutomationTuning: 'medium',
        seerScannerAutomation: true,
      };
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/`,
        body: initialProject,
      });

      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
        method: 'GET',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursorFeature.slug}/seer/setup-check/`,
        method: 'GET',
        body: {
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
              target: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
              integration_id: 123,
              auto_create_pr: true,
            },
          },
          code_mapping_repos: [],
        },
      });

      mockSeerSettingsGet(orgWithCursorFeature.slug);

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

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/projects/`,
        method: 'GET',
        body: [
          {
            projectId: project.id,
            projectSlug: project.slug,
            agent: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
            integrationId: '123',
            stoppingPoint: 'root_cause',
            autoCreatePr: false,
            automationTuning: 'medium',
            scannerAutomation: true,
            reposCount: 0,
          },
        ],
      });

      const orgWithCursorFeature = OrganizationFixture({
        features: [],
      });

      const initialProject: DetailedProject = {
        ...project,
        autofixAutomationTuning: 'medium',
        seerScannerAutomation: true,
      };
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/`,
        body: initialProject,
      });

      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
        method: 'GET',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursorFeature.slug}/seer/setup-check/`,
        method: 'GET',
        body: {
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
              target: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
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

      const seerSettingsPutRequest = MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursorFeature.slug}/${project.slug}/seer/settings/`,
        method: 'PUT',
      });

      mockSeerSettingsGet(orgWithCursorFeature.slug);

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

      // Settings changes go through seer/settings/ — no repository payload involved
      await waitFor(() => {
        expect(seerSettingsPutRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({
              autoCreatePr: true,
            }),
          })
        );
      });
    });

    // Regression test for the removed `key` remount on AutoSaveForm: the toggle
    // must re-seed when its value changes from *outside* the form. Switching the
    // stopping point to a handoff target resets autoCreatePr to false, and the
    // untouched toggle has to reflect that without a key-forced remount.
    it('re-seeds the toggle when a handoff switch resets autoCreatePr', async () => {
      MockApiClient.clearMockResponses();

      const orgWithIntegrations = OrganizationFixture({features: []});

      const initialProject: DetailedProject = {
        ...project,
        autofixAutomationTuning: 'medium',
        seerScannerAutomation: true,
      };

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithIntegrations.slug}/seer/projects/`,
        method: 'GET',
        body: [
          {
            projectId: project.id,
            projectSlug: project.slug,
            agent: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
            integrationId: '123',
            stoppingPoint: 'root_cause',
            autoCreatePr: true,
            automationTuning: 'medium',
            scannerAutomation: true,
            reposCount: 0,
          },
        ],
      });

      MockApiClient.addMockResponse({
        url: `/projects/${orgWithIntegrations.slug}/${project.slug}/`,
        body: initialProject,
      });

      MockApiClient.addMockResponse({
        url: `/projects/${orgWithIntegrations.slug}/${project.slug}/seer/repos/`,
        method: 'GET',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithIntegrations.slug}/seer/setup-check/`,
        method: 'GET',
        body: {billing: {hasAutofixQuota: true, hasScannerQuota: true}},
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithIntegrations.slug}/repos/`,
        query: {status: 'active'},
        method: 'GET',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithIntegrations.slug}/integrations/coding-agents/`,
        method: 'GET',
        body: {
          integrations: [
            {id: '123', name: 'Cursor', provider: 'cursor'},
            {id: '456', name: 'Claude', provider: 'claude_code'},
          ],
        },
      });

      MockApiClient.addMockResponse({
        url: `/projects/${orgWithIntegrations.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {
          preference: {
            repositories: [],
            automated_run_stopping_point: 'root_cause',
            automation_handoff: {
              handoff_point: 'root_cause',
              target: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
              integration_id: 123,
              auto_create_pr: true,
            },
          },
          code_mapping_repos: [],
        },
      });

      MockApiClient.addMockResponse({
        url: `/projects/${orgWithIntegrations.slug}/${project.slug}/seer/settings/`,
        method: 'PUT',
      });

      mockSeerSettingsGet(orgWithIntegrations.slug);

      render(<ProjectSeer />, {
        organization: orgWithIntegrations,
        outletContext: {project: initialProject},
      });

      // The toggle starts checked because the cursor handoff had autoCreatePr on.
      const toggle = await screen.findByRole('checkbox', {
        name: /Auto-Create Pull Requests/i,
      });
      expect(toggle).toBeChecked();

      // The settings refetch after the handoff switch reports autoCreatePr off.
      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithIntegrations.slug}/seer/projects/`,
        method: 'GET',
        body: [
          {
            projectId: project.id,
            projectSlug: project.slug,
            agent: CodingAgentProvider.CLAUDE_CODE_AGENT,
            integrationId: '456',
            stoppingPoint: 'root_cause',
            autoCreatePr: false,
            automationTuning: 'medium',
            scannerAutomation: true,
            reposCount: 0,
          },
        ],
      });

      const select = await screen.findByRole('textbox', {
        name: /Where should Seer stop/i,
      });
      await userEvent.click(select);
      await userEvent.click(await screen.findByText('Hand off to Claude Agent'));

      // Without the key remount, the untouched toggle re-seeds to unchecked.
      await waitFor(() => {
        expect(
          screen.getByRole('checkbox', {name: /Auto-Create Pull Requests/i})
        ).not.toBeChecked();
      });
    });

    it('shows integration selector when multiple cursor integrations exist', async () => {
      MockApiClient.clearMockResponses();

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/projects/`,
        method: 'GET',
        body: [
          {
            projectId: project.id,
            projectSlug: project.slug,
            agent: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
            integrationId: '123',
            stoppingPoint: 'root_cause',
            autoCreatePr: false,
            automationTuning: 'medium',
            scannerAutomation: true,
            reposCount: 0,
          },
        ],
      });

      const orgWithCursorFeature = OrganizationFixture({
        features: [],
      });

      const initialProject: DetailedProject = {
        ...project,
        autofixAutomationTuning: 'medium',
        seerScannerAutomation: true,
      };
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/`,
        body: initialProject,
      });

      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
        method: 'GET',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursorFeature.slug}/seer/setup-check/`,
        method: 'GET',
        body: {
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
              target: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
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

      mockSeerSettingsGet(orgWithCursorFeature.slug);

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

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/projects/`,
        method: 'GET',
        body: [
          {
            projectId: project.id,
            projectSlug: project.slug,
            agent: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
            integrationId: '123',
            stoppingPoint: 'root_cause',
            autoCreatePr: false,
            automationTuning: 'medium',
            scannerAutomation: true,
            reposCount: 0,
          },
        ],
      });

      const orgWithCursorFeature = OrganizationFixture({
        features: [],
      });

      const initialProject: DetailedProject = {
        ...project,
        autofixAutomationTuning: 'medium',
        seerScannerAutomation: true,
      };
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/`,
        body: initialProject,
      });

      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
        method: 'GET',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursorFeature.slug}/seer/setup-check/`,
        method: 'GET',
        body: {
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
              target: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
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

      const seerSettingsPutRequest = MockApiClient.addMockResponse({
        url: `/projects/${orgWithCursorFeature.slug}/${project.slug}/seer/settings/`,
        method: 'PUT',
      });

      mockSeerSettingsGet(orgWithCursorFeature.slug);

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

      // Settings changes go through seer/settings/ — no repository payload involved
      await waitFor(() => {
        expect(seerSettingsPutRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({
              integrationId: '456',
            }),
          })
        );
      });
    });

    it('only shows same-provider integrations in selector when both cursor and claude exist', async () => {
      MockApiClient.clearMockResponses();

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/projects/`,
        method: 'GET',
        body: [
          {
            projectId: project.id,
            projectSlug: project.slug,
            agent: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
            integrationId: '123',
            stoppingPoint: 'root_cause',
            autoCreatePr: false,
            automationTuning: 'medium',
            scannerAutomation: true,
            reposCount: 0,
          },
        ],
      });

      const initialProject: DetailedProject = {
        ...project,
        autofixAutomationTuning: 'medium',
        seerScannerAutomation: true,
      };
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/`,
        body: initialProject,
      });

      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
        method: 'GET',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/setup-check/`,
        method: 'GET',
        body: {
          billing: {hasAutofixQuota: true, hasScannerQuota: true},
        },
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/repos/`,
        query: {status: 'active'},
        method: 'GET',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/coding-agents/`,
        method: 'GET',
        body: {
          integrations: [
            {
              id: '123',
              name: 'Cursor',
              provider: 'cursor',
            },
            {
              id: '456',
              name: 'Claude',
              provider: 'claude_code',
            },
          ],
        },
      });

      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {
          preference: {
            repositories: [],
            automated_run_stopping_point: 'root_cause',
            automation_handoff: {
              handoff_point: 'root_cause',
              target: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
              integration_id: 123,
              auto_create_pr: false,
            },
          },
          code_mapping_repos: [],
        },
      });

      mockSeerSettingsGet(organization.slug);

      render(<ProjectSeer />, {
        organization,
        outletContext: {project: initialProject},
      });

      const autoCreateToggle = await screen.findByRole('checkbox', {
        name: /Auto-Create Pull Requests/i,
      });
      expect(autoCreateToggle).toBeInTheDocument();

      // With one cursor + one claude integration and cursor target active,
      // only the single cursor integration matches, so the selector should NOT appear
      expect(
        screen.queryByRole('textbox', {name: /Select Configuration/i})
      ).not.toBeInTheDocument();
    });

    it('does not show integration selector with single cursor integration', async () => {
      MockApiClient.clearMockResponses();

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/projects/`,
        method: 'GET',
        body: [
          {
            projectId: project.id,
            projectSlug: project.slug,
            agent: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
            integrationId: '123',
            stoppingPoint: 'root_cause',
            autoCreatePr: false,
            automationTuning: 'medium',
            scannerAutomation: true,
            reposCount: 0,
          },
        ],
      });

      const orgWithCursorFeature = OrganizationFixture({
        features: [],
      });

      const initialProject: DetailedProject = {
        ...project,
        autofixAutomationTuning: 'medium',
        seerScannerAutomation: true,
      };
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/`,
        body: initialProject,
      });

      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
        method: 'GET',
        body: [],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithCursorFeature.slug}/seer/setup-check/`,
        method: 'GET',
        body: {
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
              target: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
              integration_id: 123,
              auto_create_pr: false,
            },
          },
          code_mapping_repos: [],
        },
      });

      mockSeerSettingsGet(orgWithCursorFeature.slug);

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

  describe('GitLab support', () => {
    const reposWithGitlab = [
      RepositoryFixture({
        id: '1',
        name: 'getsentry/sentry',
        externalId: '101',
        provider: {id: 'integrations:github', name: 'GitHub'},
        integrationId: '201',
      }),
      RepositoryFixture({
        id: '3',
        name: 'getsentry/gitlab-repo',
        externalId: '103',
        provider: {id: 'integrations:gitlab', name: 'GitLab'},
        integrationId: '203',
      }),
    ];

    it('shows GitLab repos as selectable when seer-gitlab-support flag is on', async () => {
      const orgWithGitlabSupport = OrganizationFixture({
        features: ['seer-gitlab-support'],
      });

      // Override the repos mock from beforeEach to include a GitLab repo
      MockApiClient.addMockResponse({
        url: `/organizations/${orgWithGitlabSupport.slug}/repos/`,
        query: {status: 'active'},
        method: 'GET',
        body: reposWithGitlab,
      });

      render(<ProjectSeer />, {
        organization: orgWithGitlabSupport,
        outletContext: {project},
      });
      renderGlobalModal({organization: orgWithGitlabSupport});

      // Wait for repos to load (sentry is pre-selected via preference.repositories in beforeEach)
      expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();

      // Open the add repo modal — it shows only unselected repos
      await userEvent.click(
        screen.getByRole('button', {name: 'Add Repositories to Project'})
      );

      const modal = await screen.findByRole('dialog');

      // GitLab repo should appear in the modal and not be visually disabled
      const gitlabRepoItem = await within(modal).findByText('getsentry/gitlab-repo');
      expect(gitlabRepoItem).toBeInTheDocument();

      // The checkbox for GitLab repo should not be disabled (since the flag is on)
      const gitlabCheckbox = within(modal).getByRole('checkbox', {
        checked: false,
      });
      expect(gitlabCheckbox).toBeEnabled();
    });

    it('shows GitLab repos as disabled when seer-gitlab-support flag is off', async () => {
      // Override the repos mock from beforeEach to include a GitLab repo
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/repos/`,
        query: {status: 'active'},
        method: 'GET',
        body: reposWithGitlab,
      });

      render(<ProjectSeer />, {
        organization,
        outletContext: {project},
      });
      renderGlobalModal();

      // Wait for repos to load (sentry is pre-selected via preference.repositories in beforeEach)
      expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();

      // Open the add repo modal — it shows only unselected repos
      await userEvent.click(
        screen.getByRole('button', {name: 'Add Repositories to Project'})
      );

      const modal = await screen.findByRole('dialog');

      // GitLab repo should appear in the list but be disabled (not selectable without the flag)
      expect(within(modal).getByText('getsentry/gitlab-repo')).toBeInTheDocument();
    });
  });
});
