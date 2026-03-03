import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ClaudeCodeIntegrationCta} from 'sentry/components/events/autofix/claudeCodeIntegrationCta';
import ProjectsStore from 'sentry/stores/projectsStore';

describe('ClaudeCodeIntegrationCta', () => {
  const project = ProjectFixture();
  const organization = OrganizationFixture({
    features: ['integrations-claude-code'],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    localStorage.clear();

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      body: {
        code_mapping_repos: [],
        preference: null,
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {
        integrations: [],
      },
    });
  });

  describe('Feature Flag', () => {
    it('does not render without integrations-claude-code feature flag', () => {
      const orgWithoutFlag = OrganizationFixture({
        features: [],
      });

      const {container} = render(<ClaudeCodeIntegrationCta project={project} />, {
        organization: orgWithoutFlag,
      });

      expect(container).toBeEmptyDOMElement();
    });

    it('renders with integrations-claude-code feature flag', async () => {
      render(<ClaudeCodeIntegrationCta project={project} />, {
        organization,
      });

      expect(await screen.findByText('Claude Agent Integration')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading placeholder while fetching preferences', () => {
      render(<ClaudeCodeIntegrationCta project={project} />, {
        organization,
      });

      expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
    });

    it('shows loading placeholder while fetching integrations', () => {
      render(<ClaudeCodeIntegrationCta project={project} />, {
        organization,
      });

      expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
    });
  });

  describe('Stage 1: Integration Not Installed', () => {
    it('shows install stage when claude integration is not installed', async () => {
      render(<ClaudeCodeIntegrationCta project={project} />, {
        organization,
      });

      expect(await screen.findByText('Claude Agent Integration')).toBeInTheDocument();
      expect(
        screen.getByText(/Connect Claude to automatically hand off/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Install Claude Integration'})
      ).toBeInTheDocument();
    });

    it('links to claude integration settings', async () => {
      render(<ClaudeCodeIntegrationCta project={project} />, {
        organization,
      });

      const installLink = await screen.findByRole('button', {
        name: 'Install Claude Integration',
      });
      expect(installLink).toHaveAttribute(
        'href',
        `/settings/${organization.slug}/integrations/claude_code/`
      );
    });

    it('includes documentation link', async () => {
      render(<ClaudeCodeIntegrationCta project={project} />, {
        organization,
      });

      await screen.findByText('Claude Agent Integration');
      const docsLink = screen.getByRole('link', {name: 'Read the docs'});
      expect(docsLink).toHaveAttribute(
        'href',
        'https://docs.sentry.io/organization/integrations/claude-code/'
      );
    });
  });

  describe('Stage 2: Integration Installed but Not Configured', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/coding-agents/`,
        body: {
          integrations: [
            {
              id: '456',
              provider: 'claude_code',
              name: 'Claude',
            },
          ],
        },
      });
    });

    it('shows configure stage when integration installed but not configured', async () => {
      render(<ClaudeCodeIntegrationCta project={project} />, {
        organization,
      });

      expect(await screen.findByText('Claude Agent Integration')).toBeInTheDocument();
      expect(
        screen.getByText(/You have the Claude integration installed/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Set Seer to hand off to Claude'})
      ).toBeInTheDocument();
    });

    it('configures handoff when setup button is clicked', async () => {
      const updateMock = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        method: 'POST',
        body: {
          repositories: [],
          automated_run_stopping_point: 'root_cause',
          automation_handoff: {
            handoff_point: 'root_cause',
            target: 'claude_code_agent',
            integration_id: 456,
          },
        },
      });

      render(<ClaudeCodeIntegrationCta project={project} />, {
        organization,
      });

      const setupButton = await screen.findByRole('button', {
        name: 'Set Seer to hand off to Claude',
      });
      await userEvent.click(setupButton);

      await waitFor(() => {
        expect(updateMock).toHaveBeenCalledWith(
          `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
          expect.objectContaining({
            method: 'POST',
            data: {
              repositories: [],
              automated_run_stopping_point: 'root_cause',
              automation_handoff: {
                handoff_point: 'root_cause',
                target: 'claude_code_agent',
                integration_id: 456,
              },
            },
          })
        );
      });
    });

    it('includes link to project seer settings', async () => {
      render(<ClaudeCodeIntegrationCta project={project} />, {
        organization,
      });

      await screen.findByText('Claude Agent Integration');
      const settingsLink = screen.getByRole('link', {
        name: 'Configure in Seer project settings',
      });
      expect(settingsLink).toHaveAttribute(
        'href',
        `/settings/${organization.slug}/projects/${project.slug}/seer/`
      );
    });

    it('does not enable automation when already enabled', async () => {
      const projectWithAutomation = ProjectFixture({
        seerScannerAutomation: true,
        autofixAutomationTuning: 'medium',
      });

      const projectUpdateMock = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${projectWithAutomation.slug}/`,
        method: 'PUT',
        body: {},
      });

      const preferencesUpdateMock = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${projectWithAutomation.slug}/seer/preferences/`,
        method: 'POST',
        body: {
          repositories: [],
          automated_run_stopping_point: 'root_cause',
          automation_handoff: {
            handoff_point: 'root_cause',
            target: 'claude_code_agent',
            integration_id: 456,
          },
        },
      });

      render(<ClaudeCodeIntegrationCta project={projectWithAutomation} />, {
        organization,
      });

      const setupButton = await screen.findByRole('button', {
        name: 'Set Seer to hand off to Claude',
      });
      await userEvent.click(setupButton);

      expect(projectUpdateMock).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(preferencesUpdateMock).toHaveBeenCalledWith(
          `/projects/${organization.slug}/${projectWithAutomation.slug}/seer/preferences/`,
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('enables automation when setup button is clicked and automation is disabled', async () => {
      const projectWithoutAutomation = ProjectFixture({
        seerScannerAutomation: false,
        autofixAutomationTuning: 'off',
      });

      const updatedProject = {
        ...projectWithoutAutomation,
        seerScannerAutomation: true,
        autofixAutomationTuning: 'low',
      };

      const projectUpdateMock = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${projectWithoutAutomation.slug}/`,
        method: 'PUT',
        body: updatedProject,
      });

      const preferencesUpdateMock = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${projectWithoutAutomation.slug}/seer/preferences/`,
        method: 'POST',
        body: {
          repositories: [],
          automated_run_stopping_point: 'root_cause',
          automation_handoff: {
            handoff_point: 'root_cause',
            target: 'claude_code_agent',
            integration_id: 456,
          },
        },
      });

      const onUpdateSuccessSpy = jest.spyOn(ProjectsStore, 'onUpdateSuccess');

      render(<ClaudeCodeIntegrationCta project={projectWithoutAutomation} />, {
        organization,
      });

      const setupButton = await screen.findByRole('button', {
        name: 'Set Seer to hand off to Claude',
      });
      await userEvent.click(setupButton);

      await waitFor(() => {
        expect(projectUpdateMock).toHaveBeenCalledWith(
          `/projects/${organization.slug}/${projectWithoutAutomation.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              autofixAutomationTuning: 'low',
              seerScannerAutomation: true,
            },
          })
        );
      });

      await waitFor(() => {
        expect(onUpdateSuccessSpy).toHaveBeenCalledWith(updatedProject);
      });

      await waitFor(() => {
        expect(preferencesUpdateMock).toHaveBeenCalledWith(
          `/projects/${organization.slug}/${projectWithoutAutomation.slug}/seer/preferences/`,
          expect.objectContaining({
            method: 'POST',
            data: {
              repositories: [],
              automated_run_stopping_point: 'root_cause',
              automation_handoff: {
                handoff_point: 'root_cause',
                target: 'claude_code_agent',
                integration_id: 456,
              },
            },
          })
        );
      });

      onUpdateSuccessSpy.mockRestore();
    });
  });

  describe('Stage 2: Automation Disabled with Handoff Configured', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/coding-agents/`,
        body: {
          integrations: [
            {
              id: '456',
              provider: 'claude_code',
              name: 'Claude',
            },
          ],
        },
      });

      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        body: {
          code_mapping_repos: [],
          preference: {
            repositories: [],
            automated_run_stopping_point: 'root_cause',
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'claude_code_agent',
              integration_id: 456,
            },
          },
        },
      });
    });

    it('shows configure stage when handoff is configured but automation is disabled', async () => {
      const projectWithoutAutomation = ProjectFixture({
        seerScannerAutomation: false,
        autofixAutomationTuning: 'off',
      });

      render(<ClaudeCodeIntegrationCta project={projectWithoutAutomation} />, {
        organization,
      });

      expect(await screen.findByText('Claude Agent Integration')).toBeInTheDocument();
      expect(
        screen.getByText(/You have the Claude integration installed/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Set Seer to hand off to Claude'})
      ).toBeInTheDocument();
      expect(screen.queryByText(/Claude handoff is active/)).not.toBeInTheDocument();
    });
  });

  describe('Stage 3: Integration Configured', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/coding-agents/`,
        body: {
          integrations: [
            {
              id: '456',
              provider: 'claude_code',
              name: 'Claude',
            },
          ],
        },
      });

      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        body: {
          code_mapping_repos: [],
          preference: {
            repositories: [],
            automated_run_stopping_point: 'root_cause',
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'claude_code_agent',
              integration_id: 456,
            },
          },
        },
      });
    });

    it('shows configured stage when handoff is set up and automation is enabled', async () => {
      const projectWithAutomation = ProjectFixture({
        seerScannerAutomation: true,
        autofixAutomationTuning: 'medium',
      });

      render(<ClaudeCodeIntegrationCta project={projectWithAutomation} />, {
        organization,
      });

      expect(await screen.findByText('Claude Agent Integration')).toBeInTheDocument();
      expect(screen.getByText(/Claude handoff is active/)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Set Seer to hand off to Claude'})
      ).not.toBeInTheDocument();
    });

    it('does not show setup button in configured stage', async () => {
      const projectWithAutomation = ProjectFixture({
        seerScannerAutomation: true,
        autofixAutomationTuning: 'medium',
      });

      render(<ClaudeCodeIntegrationCta project={projectWithAutomation} />, {
        organization,
      });

      await screen.findByText('Claude Agent Integration');
      expect(
        screen.queryByRole('button', {name: 'Set Seer to hand off to Claude'})
      ).not.toBeInTheDocument();
    });
  });
});
