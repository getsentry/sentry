import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {CursorIntegrationCta} from 'sentry/components/events/autofix/cursorIntegrationCta';
import ProjectsStore from 'sentry/stores/projectsStore';

describe('CursorIntegrationCta', () => {
  const project = ProjectFixture();
  const organization = OrganizationFixture({
    features: ['integrations-cursor'],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    localStorage.clear();

    // Default mock for seer preferences
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      body: {
        code_mapping_repos: [],
        preference: null,
      },
    });

    // Default mock for coding agent integrations
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {
        integrations: [],
      },
    });
  });

  describe('Feature Flag', () => {
    it('does not render without integrations-cursor feature flag', () => {
      const orgWithoutFlag = OrganizationFixture({
        features: [],
      });

      const {container} = render(<CursorIntegrationCta project={project} />, {
        organization: orgWithoutFlag,
      });

      expect(container).toBeEmptyDOMElement();
    });

    it('renders with integrations-cursor feature flag', async () => {
      render(<CursorIntegrationCta project={project} />, {
        organization,
      });

      expect(await screen.findByText('Cursor Agent Integration')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading placeholder while fetching preferences', () => {
      render(<CursorIntegrationCta project={project} />, {
        organization,
      });

      expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
    });

    it('shows loading placeholder while fetching integrations', () => {
      render(<CursorIntegrationCta project={project} />, {
        organization,
      });

      expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
    });
  });

  describe('Stage 1: Integration Not Installed', () => {
    it('shows install stage when cursor integration is not installed', async () => {
      render(<CursorIntegrationCta project={project} />, {
        organization,
      });

      expect(await screen.findByText('Cursor Agent Integration')).toBeInTheDocument();
      expect(
        screen.getByText(/Connect Cursor to automatically hand off/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Install Cursor Integration'})
      ).toBeInTheDocument();
    });

    it('links to cursor integration settings', async () => {
      render(<CursorIntegrationCta project={project} />, {
        organization,
      });

      const installLink = await screen.findByRole('button', {
        name: 'Install Cursor Integration',
      });
      expect(installLink).toHaveAttribute('href', '/settings/integrations/cursor/');
    });

    it('includes documentation link', async () => {
      render(<CursorIntegrationCta project={project} />, {
        organization,
      });

      await screen.findByText('Cursor Agent Integration');
      const docsLink = screen.getByRole('link', {name: 'Read the docs'});
      expect(docsLink).toHaveAttribute(
        'href',
        'https://docs.sentry.io/organization/integrations/cursor/'
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
              id: '123',
              provider: 'cursor',
              name: 'Cursor',
            },
          ],
        },
      });
    });

    it('shows configure stage when integration installed but not configured', async () => {
      render(<CursorIntegrationCta project={project} />, {
        organization,
      });

      expect(await screen.findByText('Cursor Agent Integration')).toBeInTheDocument();
      expect(
        screen.getByText(/You have the Cursor integration installed/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Set Seer to hand off to Cursor'})
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
            target: 'cursor_background_agent',
            integration_id: 123,
          },
        },
      });

      render(<CursorIntegrationCta project={project} />, {
        organization,
      });

      const setupButton = await screen.findByRole('button', {
        name: 'Set Seer to hand off to Cursor',
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
                target: 'cursor_background_agent',
                integration_id: 123,
              },
            },
          })
        );
      });
    });

    it('includes link to project seer settings', async () => {
      render(<CursorIntegrationCta project={project} />, {
        organization,
      });

      await screen.findByText('Cursor Agent Integration');
      const settingsLink = screen.getByRole('link', {
        name: 'Configure in Seer project settings',
      });
      expect(settingsLink).toHaveAttribute(
        'href',
        `/settings/projects/${project.slug}/seer/`
      );
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
            target: 'cursor_background_agent',
            integration_id: 123,
          },
        },
      });

      const onUpdateSuccessSpy = jest.spyOn(ProjectsStore, 'onUpdateSuccess');

      render(<CursorIntegrationCta project={projectWithoutAutomation} />, {
        organization,
      });

      const setupButton = await screen.findByRole('button', {
        name: 'Set Seer to hand off to Cursor',
      });
      await userEvent.click(setupButton);

      // Should first enable automation
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

      // Should update the project store
      await waitFor(() => {
        expect(onUpdateSuccessSpy).toHaveBeenCalledWith(updatedProject);
      });

      // Then configure handoff
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
                target: 'cursor_background_agent',
                integration_id: 123,
              },
            },
          })
        );
      });

      onUpdateSuccessSpy.mockRestore();
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
            target: 'cursor_background_agent',
            integration_id: 123,
          },
        },
      });

      render(<CursorIntegrationCta project={projectWithAutomation} />, {
        organization,
      });

      const setupButton = await screen.findByRole('button', {
        name: 'Set Seer to hand off to Cursor',
      });
      await userEvent.click(setupButton);

      // Should NOT call project update since automation is already enabled
      expect(projectUpdateMock).not.toHaveBeenCalled();

      // Should only configure handoff
      await waitFor(() => {
        expect(preferencesUpdateMock).toHaveBeenCalledWith(
          `/projects/${organization.slug}/${projectWithAutomation.slug}/seer/preferences/`,
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });
  });

  describe('Stage 2: Automation Disabled with Handoff Configured', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/coding-agents/`,
        body: {
          integrations: [
            {
              id: '123',
              provider: 'cursor',
              name: 'Cursor',
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
              target: 'cursor_background_agent',
              integration_id: 123,
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

      render(<CursorIntegrationCta project={projectWithoutAutomation} />, {
        organization,
      });

      // Should show configure stage, not configured stage
      expect(await screen.findByText('Cursor Agent Integration')).toBeInTheDocument();
      expect(
        screen.getByText(/You have the Cursor integration installed/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Set Seer to hand off to Cursor'})
      ).toBeInTheDocument();

      // Should NOT show the configured message
      expect(screen.queryByText(/Cursor handoff is active/)).not.toBeInTheDocument();
    });
  });

  describe('Stage 3: Integration Configured', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/coding-agents/`,
        body: {
          integrations: [
            {
              id: '123',
              provider: 'cursor',
              name: 'Cursor',
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
              target: 'cursor_background_agent',
              integration_id: 123,
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

      render(<CursorIntegrationCta project={projectWithAutomation} />, {
        organization,
      });

      expect(await screen.findByText('Cursor Agent Integration')).toBeInTheDocument();
      expect(screen.getByText(/Cursor handoff is active/)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Set Seer to hand off to Cursor'})
      ).not.toBeInTheDocument();
    });

    it('does not show setup button in configured stage', async () => {
      const projectWithAutomation = ProjectFixture({
        seerScannerAutomation: true,
        autofixAutomationTuning: 'medium',
      });

      render(<CursorIntegrationCta project={projectWithAutomation} />, {
        organization,
      });

      await screen.findByText('Cursor Agent Integration');
      expect(
        screen.queryByRole('button', {name: 'Set Seer to hand off to Cursor'})
      ).not.toBeInTheDocument();
    });
  });
});
