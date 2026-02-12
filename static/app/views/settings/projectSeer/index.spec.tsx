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

  describe('Coding Agent Selector', () => {
    it('can select Cursor as the coding agent', async () => {
      MockApiClient.clearMockResponses();

      const initialProject: Project = {
        ...project,
        autofixAutomationTuning: 'medium',
        seerScannerAutomation: true,
      };

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/setup-check/`,
        method: 'GET',
        body: {
          setupAcknowledgement: {orgHasAcknowledged: true, userHasAcknowledged: true},
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
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {
          code_mapping_repos: [],
        },
      });

      // Mock the coding agent integrations endpoint with a Cursor integration
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
          ],
        },
      });

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
        outletContext: {project: initialProject},
      });

      // Find the coding agent selector
      const select = await screen.findByRole('textbox', {
        name: /Coding Agent/i,
      });

      act(() => {
        select.focus();
      });

      // Open the menu and select Cursor
      await userEvent.click(select);
      const cursorOptions = await screen.findAllByText('Cursor');
      await userEvent.click(cursorOptions[0]!);

      // The seer preferences POST should be called with the Cursor handoff config
      await waitFor(() => {
        expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({
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

    it('can switch back to Seer from Cursor', async () => {
      MockApiClient.clearMockResponses();

      const initialProject: Project = {
        ...project,
        autofixAutomationTuning: 'medium',
        seerScannerAutomation: true,
      };

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/setup-check/`,
        method: 'GET',
        body: {
          setupAcknowledgement: {orgHasAcknowledged: true, userHasAcknowledged: true},
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
          ],
        },
      });

      // Mock preferences with Cursor handoff already configured
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {
          preference: {
            repositories: [],
            automated_run_stopping_point: 'root_cause',
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent',
              integration_id: 123,
            },
          },
          code_mapping_repos: [],
        },
      });

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
        outletContext: {project: initialProject},
      });

      // Wait for the page to fully load — the "Where should Seer stop?" field
      // only appears after both preferences and form data are loaded
      await screen.findByRole('textbox', {name: /Where should Seer stop/i});

      // Now the coding agent selector should be stable
      const select = screen.getByRole('textbox', {
        name: /Coding Agent/i,
      });

      act(() => {
        select.focus();
      });

      await userEvent.click(select);

      // Find and click the Seer option in the dropdown
      const seerOptions = await screen.findAllByText('Seer (default)');
      await userEvent.click(seerOptions[0]!);

      // The seer preferences POST should be called with the Seer handoff config
      await waitFor(() => {
        expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({
              repositories: expect.any(Array),
              automation_handoff: {
                handoff_point: 'root_cause',
                target: 'seer_coding_agent',
              },
            }),
          })
        );
      });
    });

    it('is not visible when automation is disabled', async () => {
      const initialProject: Project = {
        ...project,
        autofixAutomationTuning: 'off',
        seerScannerAutomation: true,
      };

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
          ],
        },
      });

      render(<ProjectSeer />, {
        organization,
        outletContext: {project: initialProject},
      });

      // Wait for the page to load
      await screen.findByText(/Automation/i);

      // The coding agent selector should NOT be visible when automation is off
      expect(
        screen.queryByRole('textbox', {name: /Coding Agent/i})
      ).not.toBeInTheDocument();
    });

    it('defaults to Seer when no integrations are available', async () => {
      const initialProject: Project = {
        ...project,
        autofixAutomationTuning: 'medium',
        seerScannerAutomation: true,
      };

      render(<ProjectSeer />, {
        organization,
        outletContext: {project: initialProject},
      });

      // Find the coding agent selector - it should show Seer (default) as the value
      const select = await screen.findByRole('textbox', {
        name: /Coding Agent/i,
      });
      expect(select).toBeInTheDocument();
    });

    it('filters out integrations that require user identity', async () => {
      const initialProject: Project = {
        ...project,
        autofixAutomationTuning: 'medium',
        seerScannerAutomation: true,
      };

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/coding-agents/`,
        method: 'GET',
        body: {
          integrations: [
            {
              id: '123',
              name: 'Cursor',
              provider: 'cursor',
              requires_identity: false,
            },
            {
              id: '456',
              name: 'GitHub Copilot',
              provider: 'github_copilot',
              requires_identity: true,
            },
          ],
        },
      });

      render(<ProjectSeer />, {
        organization,
        outletContext: {project: initialProject},
      });

      // Find the coding agent selector
      const select = await screen.findByRole('textbox', {
        name: /Coding Agent/i,
      });

      act(() => {
        select.focus();
      });

      // Open the dropdown
      await userEvent.click(select);

      // Cursor should be in the list, Copilot should not
      expect(await screen.findByText('Cursor')).toBeInTheDocument();
      expect(screen.queryByText('GitHub Copilot')).not.toBeInTheDocument();
    });

    it('can switch between multiple cursor integrations', async () => {
      MockApiClient.clearMockResponses();

      const initialProject: Project = {
        ...project,
        autofixAutomationTuning: 'medium',
        seerScannerAutomation: true,
      };

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/setup-check/`,
        method: 'GET',
        body: {
          setupAcknowledgement: {orgHasAcknowledged: true, userHasAcknowledged: true},
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
              name: 'Cursor - user1@example.com',
              provider: 'cursor',
            },
            {
              id: '456',
              name: 'Cursor - user2@example.com',
              provider: 'cursor',
            },
          ],
        },
      });

      // Mock preferences with first integration selected
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {
          preference: {
            repositories: [],
            automated_run_stopping_point: 'root_cause',
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent',
              integration_id: 123,
            },
          },
          code_mapping_repos: [],
        },
      });

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
        outletContext: {project: initialProject},
      });

      // Wait for the page to fully load — the "Where should Seer stop?" field
      // only appears after both preferences and form data are loaded
      await screen.findByRole('textbox', {name: /Where should Seer stop/i});

      // Now the coding agent selector should be stable
      const select = screen.getByRole('textbox', {
        name: /Coding Agent/i,
      });

      act(() => {
        select.focus();
      });

      // Open and select the second integration
      await userEvent.click(select);
      const secondOptions = await screen.findAllByText('Cursor - user2@example.com');
      await userEvent.click(secondOptions[0]!);

      // The seer preferences POST should be called with the new integration ID
      await waitFor(() => {
        expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({
              automation_handoff: expect.objectContaining({
                target: 'cursor_background_agent',
                integration_id: 456,
              }),
              repositories: expect.any(Array),
            }),
          })
        );
      });
    });
  });
});
