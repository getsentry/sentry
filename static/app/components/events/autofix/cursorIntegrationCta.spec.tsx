import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture, ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {CursorIntegrationCta} from 'sentry/components/events/autofix/cursorIntegrationCta';
import {CodingAgentProvider} from 'sentry/components/events/autofix/types';
import {ProjectsStore} from 'sentry/stores/projectsStore';

describe('CursorIntegrationCta', () => {
  const project = ProjectFixture();
  const enabledProject = DetailedProjectFixture({
    ...project,
    seerScannerAutomation: true,
    autofixAutomationTuning: 'medium',
  });
  const organization = OrganizationFixture();

  // The CTA reads handoff state from the project's seer setting. Only fires
  // once an integration exists, so the install-stage tests don't need it.
  const mockSeerSettings = (
    overrides: Partial<{
      agent: string;
      integrationId: string | null;
    }> = {}
  ) =>
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      method: 'GET',
      body: {
        projectId: project.id,
        projectSlug: project.slug,
        agent: 'seer',
        integrationId: null,
        stoppingPoint: 'root_cause',
        autoCreatePr: null,
        automationTuning: 'medium',
        scannerAutomation: true,
        reposCount: 0,
        ...overrides,
      },
    });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    localStorage.clear();

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${enabledProject.slug}/`,
      body: enabledProject,
    });

    // Default mock for coding agent integrations
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {
        integrations: [],
      },
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
      expect(installLink).toHaveAttribute(
        'href',
        `/settings/${organization.slug}/integrations/cursor/`
      );
    });

    it('includes documentation link', async () => {
      render(<CursorIntegrationCta project={project} />, {
        organization,
      });

      await screen.findByText('Cursor Agent Integration');
      const docsLink = screen.getByRole('link', {name: 'Read the docs'});
      expect(docsLink).toHaveAttribute(
        'href',
        'https://docs.sentry.io/organization/integrations/coding-agents/cursor/'
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

      // Setting still points at Seer — handoff not configured for this agent.
      mockSeerSettings();
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

    it('configures handoff through the seer/settings/ endpoint when setup button is clicked', async () => {
      const updateMock = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
        method: 'PUT',
        body: {},
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
          `/projects/${organization.slug}/${project.slug}/seer/settings/`,
          expect.objectContaining({
            method: 'PUT',
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
        `/settings/${organization.slug}/projects/${project.slug}/seer/`
      );
    });

    it('enables automation when setup button is clicked and automation is disabled', async () => {
      const projectWithoutAutomation = DetailedProjectFixture({
        seerScannerAutomation: false,
        autofixAutomationTuning: 'off',
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${projectWithoutAutomation.slug}/`,
        body: projectWithoutAutomation,
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

      const settingsUpdateMock = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${projectWithoutAutomation.slug}/seer/settings/`,
        method: 'PUT',
        body: {},
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

      // Then configure handoff through the settings endpoint
      await waitFor(() => {
        expect(settingsUpdateMock).toHaveBeenCalledWith(
          `/projects/${organization.slug}/${projectWithoutAutomation.slug}/seer/settings/`,
          expect.objectContaining({
            method: 'PUT',
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

      onUpdateSuccessSpy.mockRestore();
    });

    it('does not enable automation when already enabled', async () => {
      const projectWithAutomation = DetailedProjectFixture({
        seerScannerAutomation: true,
        autofixAutomationTuning: 'medium',
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${projectWithAutomation.slug}/`,
        body: projectWithAutomation,
      });

      const projectUpdateMock = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${projectWithAutomation.slug}/`,
        method: 'PUT',
        body: {},
      });

      const settingsUpdateMock = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${projectWithAutomation.slug}/seer/settings/`,
        method: 'PUT',
        body: {},
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
        expect(settingsUpdateMock).toHaveBeenCalledWith(
          `/projects/${organization.slug}/${projectWithAutomation.slug}/seer/settings/`,
          expect.objectContaining({
            method: 'PUT',
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

      // Handoff is set to Cursor, but the project's automation is disabled.
      mockSeerSettings({
        agent: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
        integrationId: '123',
      });
    });

    it('shows configure stage when handoff is configured but automation is disabled', async () => {
      const projectWithoutAutomation = DetailedProjectFixture({
        seerScannerAutomation: false,
        autofixAutomationTuning: 'off',
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${projectWithoutAutomation.slug}/`,
        body: projectWithoutAutomation,
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

      // Handoff is configured to Cursor.
      mockSeerSettings({
        agent: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
        integrationId: '123',
      });
    });

    it('shows configured stage when handoff is set up and automation is enabled', async () => {
      const projectWithAutomation = DetailedProjectFixture({
        seerScannerAutomation: true,
        autofixAutomationTuning: 'medium',
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${projectWithAutomation.slug}/`,
        body: projectWithAutomation,
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

    it('treats missing scanner automation as enabled when tuning is enabled', async () => {
      const projectWithAutomation = DetailedProjectFixture({
        autofixAutomationTuning: 'medium',
        seerScannerAutomation: undefined,
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${projectWithAutomation.slug}/`,
        body: projectWithAutomation,
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
      const projectWithAutomation = DetailedProjectFixture({
        seerScannerAutomation: true,
        autofixAutomationTuning: 'medium',
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${projectWithAutomation.slug}/`,
        body: projectWithAutomation,
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
