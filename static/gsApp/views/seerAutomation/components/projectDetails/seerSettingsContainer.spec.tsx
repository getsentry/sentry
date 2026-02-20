import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import SeerSettingsContainer from 'getsentry/views/seerAutomation/components/projectDetails/seerSettingsContainer';

describe('SeerSettingsContainer', () => {
  const project = ProjectFixture({autofixAutomationTuning: 'medium'});
  const cursorIntegration = {id: '123', name: 'Cursor', provider: 'cursor'};

  const preferencesGetUrl = `/projects/org-slug/${project.slug}/seer/preferences/`;
  const preferencesPostUrl = `/projects/org-slug/${project.slug}/seer/preferences/`;
  const codingAgentsUrl = `/organizations/org-slug/integrations/coding-agents/`;

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('with seer-agent-pr-consolidation flag ON', () => {
    const organization = OrganizationFixture({
      features: ['integrations-cursor', 'seer-agent-pr-consolidation'],
    });

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: codingAgentsUrl,
        body: {integrations: [cursorIntegration]},
      });
      MockApiClient.addMockResponse({
        url: preferencesGetUrl,
        body: {preference: {repositories: []}, code_mapping_repos: []},
      });
    });

    it('shows a single "Coding Agent" panel instead of separate panels', async () => {
      render(
        <SeerSettingsContainer
          canWrite
          project={project}
          preference={{repositories: []}}
        />,
        {organization}
      );

      expect(await screen.findByText('Coding Agent')).toBeInTheDocument();
      expect(screen.queryByText('Seer Agent')).not.toBeInTheDocument();
    });

    it('PR toggle reads from automated_run_stopping_point even when auto_create_pr differs', async () => {
      render(
        <SeerSettingsContainer
          canWrite
          project={project}
          preference={{
            repositories: [],
            automated_run_stopping_point: 'open_pr',
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent',
              integration_id: 123,
              auto_create_pr: false,
            },
          }}
        />,
        {organization}
      );

      const prToggle = await screen.findByRole('checkbox', {
        name: /Allow PR Auto Creation/i,
      });
      expect(prToggle).toBeChecked();
    });

    it('toggling PR writes to both automated_run_stopping_point and auto_create_pr', async () => {
      const postRequest = MockApiClient.addMockResponse({
        url: preferencesPostUrl,
        method: 'POST',
        body: {},
      });

      render(
        <SeerSettingsContainer
          canWrite
          project={project}
          preference={{
            repositories: [],
            automated_run_stopping_point: 'code_changes',
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent',
              integration_id: 123,
              auto_create_pr: false,
            },
          }}
        />,
        {organization}
      );

      await userEvent.click(
        await screen.findByRole('checkbox', {name: /Allow PR Auto Creation/i})
      );

      await waitFor(() => expect(postRequest).toHaveBeenCalled());
      expect(postRequest).toHaveBeenCalledWith(
        preferencesPostUrl,
        expect.objectContaining({
          data: expect.objectContaining({
            automated_run_stopping_point: 'open_pr',
            automation_handoff: expect.objectContaining({auto_create_pr: true}),
          }),
        })
      );
    });

    it('preserves PR toggle value when enabling Cursor handoff', async () => {
      const postRequest = MockApiClient.addMockResponse({
        url: preferencesPostUrl,
        method: 'POST',
        body: {},
      });

      render(
        <SeerSettingsContainer
          canWrite
          project={project}
          preference={{
            repositories: [],
            automated_run_stopping_point: 'open_pr',
          }}
        />,
        {organization}
      );

      await userEvent.click(
        await screen.findByRole('checkbox', {name: /Hand off to Cursor/i})
      );

      await waitFor(() => expect(postRequest).toHaveBeenCalled());
      expect(postRequest).toHaveBeenCalledWith(
        preferencesPostUrl,
        expect.objectContaining({
          data: expect.objectContaining({
            automation_handoff: expect.objectContaining({auto_create_pr: true}),
          }),
        })
      );
    });
  });

  describe('with seer-agent-pr-consolidation flag OFF', () => {
    const organization = OrganizationFixture({
      features: ['integrations-cursor'],
    });

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: codingAgentsUrl,
        body: {integrations: [cursorIntegration]},
      });
      MockApiClient.addMockResponse({
        url: preferencesGetUrl,
        body: {preference: {repositories: []}, code_mapping_repos: []},
      });
    });

    it('shows separate "Seer Agent" and "Coding Agent" panels', async () => {
      render(
        <SeerSettingsContainer
          canWrite
          project={project}
          preference={{repositories: []}}
        />,
        {organization}
      );

      expect(await screen.findByText('Seer Agent')).toBeInTheDocument();
      expect(screen.getByText('Coding Agent')).toBeInTheDocument();
    });

    it('enabling Cursor sets auto_create_pr to false regardless of automated_run_stopping_point', async () => {
      const postRequest = MockApiClient.addMockResponse({
        url: preferencesPostUrl,
        method: 'POST',
        body: {},
      });

      render(
        <SeerSettingsContainer
          canWrite
          project={project}
          preference={{
            repositories: [],
            automated_run_stopping_point: 'open_pr',
          }}
        />,
        {organization}
      );

      await userEvent.click(
        await screen.findByRole('checkbox', {name: /Hand off to Cursor/i})
      );

      await waitFor(() => expect(postRequest).toHaveBeenCalled());
      expect(postRequest).toHaveBeenCalledWith(
        preferencesPostUrl,
        expect.objectContaining({
          data: expect.objectContaining({
            automation_handoff: expect.objectContaining({auto_create_pr: false}),
          }),
        })
      );
    });

    it('PR toggle is disabled when Cursor is configured', async () => {
      render(
        <SeerSettingsContainer
          canWrite
          project={project}
          preference={{
            repositories: [],
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent',
              integration_id: 123,
            },
          }}
        />,
        {organization}
      );

      const prToggle = await screen.findByRole('checkbox', {
        name: /Allow PR Auto Creation/i,
      });
      expect(prToggle).toBeDisabled();
    });

    it('selecting an integration via SelectField sets auto_create_pr to false regardless of automated_run_stopping_point', async () => {
      const secondIntegration = {id: '456', name: 'Cursor 2', provider: 'cursor'};
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: codingAgentsUrl,
        body: {integrations: [cursorIntegration, secondIntegration]},
      });
      MockApiClient.addMockResponse({
        url: preferencesGetUrl,
        body: {preference: {repositories: []}, code_mapping_repos: []},
      });
      const postRequest = MockApiClient.addMockResponse({
        url: preferencesPostUrl,
        method: 'POST',
        body: {},
      });

      render(
        <SeerSettingsContainer
          canWrite
          project={project}
          preference={{
            repositories: [],
            automated_run_stopping_point: 'open_pr',
          }}
        />,
        {organization}
      );

      await userEvent.click(
        await screen.findByRole('textbox', {name: /Coding Agent Integration/i})
      );
      await userEvent.click(
        await screen.findByText(`${cursorIntegration.name} (${cursorIntegration.id})`)
      );

      await waitFor(() => expect(postRequest).toHaveBeenCalled());
      expect(postRequest).toHaveBeenCalledWith(
        preferencesPostUrl,
        expect.objectContaining({
          data: expect.objectContaining({
            automation_handoff: expect.objectContaining({auto_create_pr: false}),
          }),
        })
      );
    });
  });
});
