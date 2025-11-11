import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {CursorIntegrationCta} from 'sentry/components/events/autofix/cursorIntegrationCta';

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
        'https://docs.sentry.io/integrations/cursor/'
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

    it('shows configured stage when handoff is set up', async () => {
      render(<CursorIntegrationCta project={project} />, {
        organization,
      });

      expect(await screen.findByText('Cursor Agent Integration')).toBeInTheDocument();
      expect(screen.getByText(/Cursor handoff is active/)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Set Seer to hand off to Cursor'})
      ).not.toBeInTheDocument();
    });

    it('does not show setup button in configured stage', async () => {
      render(<CursorIntegrationCta project={project} />, {
        organization,
      });

      await screen.findByText('Cursor Agent Integration');
      expect(
        screen.queryByRole('button', {name: 'Set Seer to hand off to Cursor'})
      ).not.toBeInTheDocument();
    });
  });

  describe('Dismissible Functionality', () => {
    const dismissKey = 'test-dismiss-key';

    it('shows dismiss button when dismissible is true', async () => {
      render(
        <CursorIntegrationCta project={project} dismissible dismissKey={dismissKey} />,
        {
          organization,
        }
      );

      expect(await screen.findByRole('button', {name: 'Dismiss'})).toBeInTheDocument();
    });

    it('does not show dismiss button when dismissible is false', async () => {
      render(<CursorIntegrationCta project={project} dismissible={false} />, {
        organization,
      });

      await screen.findByText('Cursor Agent Integration');
      expect(screen.queryByRole('button', {name: 'Dismiss'})).not.toBeInTheDocument();
    });

    it('hides component when dismissed', async () => {
      render(
        <CursorIntegrationCta project={project} dismissible dismissKey={dismissKey} />,
        {
          organization,
        }
      );

      const dismissButton = await screen.findByRole('button', {name: 'Dismiss'});
      await userEvent.click(dismissButton);

      expect(screen.queryByText('Cursor Agent Integration')).not.toBeInTheDocument();

      // Verify localStorage was set
      expect(localStorage.getItem(dismissKey)).toBe('true');
      expect(localStorage.getItem(`${dismissKey}-stage`)).toBe('install');
    });

    it('respects existing dismissal from localStorage', () => {
      localStorage.setItem(dismissKey, 'true');

      const {container} = render(
        <CursorIntegrationCta project={project} dismissible dismissKey={dismissKey} />,
        {
          organization,
        }
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('resets dismissal when stage changes', async () => {
      localStorage.setItem(dismissKey, 'true');
      localStorage.setItem(`${dismissKey}-stage`, 'install');

      // Now mock the integration being installed (stage changes to 'configure')
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

      render(
        <CursorIntegrationCta project={project} dismissible dismissKey={dismissKey} />,
        {
          organization,
        }
      );

      // Component should be visible since stage changed
      expect(await screen.findByText('Cursor Agent Integration')).toBeInTheDocument();
      expect(localStorage.getItem(dismissKey)).toBeNull();
    });
  });
});
