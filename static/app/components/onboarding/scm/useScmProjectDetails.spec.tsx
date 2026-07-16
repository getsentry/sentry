import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';
import {IssueAlertActionType} from 'sentry/types/alerts';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {MultipleCheckboxOptions} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {
  DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
  RuleAction,
} from 'sentry/views/projectInstall/issueAlertOptions';

import {useScmProjectDetails, getSubmitTooltipText} from './useScmProjectDetails';

const pythonPlatform: OnboardingSelectedSDK = {
  key: 'python',
  name: 'Python',
  language: 'python',
  type: 'language',
  link: 'https://docs.sentry.io/platforms/python/',
  category: 'popular',
};

describe('getSubmitTooltipText', () => {
  const none_missing = {
    platform: false,
    projectName: false,
    team: false,
    notificationChannel: false,
  };

  it('returns undefined when nothing is missing', () => {
    expect(getSubmitTooltipText(none_missing)).toBeUndefined();
  });

  it('returns a summary when multiple fields are missing', () => {
    expect(
      getSubmitTooltipText({...none_missing, platform: true, projectName: true})
    ).toBe('Please fill out all the required fields');
  });

  it('names the platform when it is the only missing field', () => {
    expect(getSubmitTooltipText({...none_missing, platform: true})).toBe(
      'Please select a platform'
    );
  });

  it('names the project name when it is the only missing field', () => {
    expect(getSubmitTooltipText({...none_missing, projectName: true})).toBe(
      'Please provide a project name'
    );
  });

  it('names the team when it is the only missing field', () => {
    expect(getSubmitTooltipText({...none_missing, team: true})).toBe(
      'Please select a team'
    );
  });

  it('names the notification channel when it is the only missing field', () => {
    expect(getSubmitTooltipText({...none_missing, notificationChannel: true})).toBe(
      'Please provide an integration channel for alert notifications'
    );
  });
});

describe('useScmProjectDetails', () => {
  const organization = OrganizationFixture();
  const adminTeam = TeamFixture({slug: 'admin-team', access: ['team:admin']});

  function renderDetails(
    overrides: Partial<Parameters<typeof useScmProjectDetails>[0]> = {}
  ) {
    return renderHookWithProviders(
      () =>
        useScmProjectDetails({
          analyticsFlow: 'project-creation',
          allowMemberWithoutTeam: true,
          selectedPlatform: pythonPlatform,
          selectedRepository: undefined,
          projectDetailsForm: {projectName: 'my-project'},
          onProjectDetailsFormChange: jest.fn(),
          onComplete: jest.fn(),
          ...overrides,
        }),
      {organization}
    );
  }

  beforeEach(() => {
    // useCreateNotificationAction queries messaging integrations on mount.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [],
      match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
    });
  });

  afterEach(() => {
    TeamStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('requires an integration channel when notifying via integration', () => {
    TeamStore.loadInitialData([adminTeam]);
    ProjectsStore.loadInitialData([]);

    const {result} = renderDetails();

    // Default actions are email-only, so no channel is required.
    expect(result.current.missingFields.notificationChannel).toBe(false);

    // Selecting the integration action with no channel blocks submission.
    act(() => {
      result.current.notificationProps.setActions([
        MultipleCheckboxOptions.EMAIL,
        MultipleCheckboxOptions.INTEGRATION,
      ]);
    });
    expect(result.current.missingFields.notificationChannel).toBe(true);
    expect(result.current.canSubmit).toBe(false);

    // Picking a channel clears the requirement.
    act(() => {
      result.current.notificationProps.setChannel({label: '#general', value: '#general'});
    });
    expect(result.current.missingFields.notificationChannel).toBe(false);
  });

  it('does not report the team as missing while teams are still loading', () => {
    // TeamStore starts in its loading state with no teams, as during the
    // initial fetch. The team is unresolved only because firstAdminTeam isn't
    // available yet, not because the user needs to pick one.
    TeamStore.reset();
    ProjectsStore.loadInitialData([]);

    const {result} = renderDetails();

    expect(result.current.missingFields.team).toBe(false);
    // Submission is still blocked until teams finish loading.
    expect(result.current.canSubmit).toBe(false);
  });

  it('reports the team as missing once teams have loaded and none is available', () => {
    // Teams have loaded but the viewer has no team to default to, so the team
    // genuinely needs to be selected (onboarding-style: no member fallback).
    TeamStore.loadInitialData([]);
    ProjectsStore.loadInitialData([]);

    const {result} = renderDetails({allowMemberWithoutTeam: false});

    expect(result.current.missingFields.team).toBe(true);
  });

  it('resolves the team from the first admin team once teams have loaded', () => {
    TeamStore.loadInitialData([adminTeam]);
    ProjectsStore.loadInitialData([]);

    const {result} = renderDetails();

    expect(result.current.teamSlug).toBe(adminTeam.slug);
    expect(result.current.missingFields.team).toBe(false);
    expect(result.current.canSubmit).toBe(true);
  });

  describe('notification action persist/restore/reuse', () => {
    const slackIntegration = OrganizationIntegrationsFixture({
      id: '10',
      name: 'eng-workspace',
      status: 'active',
      provider: {
        key: 'slack',
        slug: 'slack',
        name: 'Slack',
        canAdd: true,
        canDisable: false,
        features: [],
        aspects: {},
      },
    });

    beforeEach(() => {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/`,
        body: [slackIntegration],
        match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/`,
        body: organization,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/`,
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: [],
      });
      TeamStore.loadInitialData([adminTeam]);
      ProjectsStore.loadInitialData([]);
    });

    it('includes notificationAction in the submittedForm passed to onComplete', async () => {
      const createdProject = ProjectFixture({slug: 'my-project', platform: 'python'});

      MockApiClient.addMockResponse({
        url: `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
        method: 'POST',
        body: createdProject,
      });

      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${createdProject.slug}/rules/`,
        method: 'POST',
        body: {},
      });

      const onComplete = jest.fn();
      const {result} = renderDetails({
        projectDetailsForm: {
          projectName: 'my-project',
          teamSlug: adminTeam.slug,
          alertRuleConfig: DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
        },
        onComplete,
      });

      await waitFor(() =>
        expect(result.current.notificationProps.provider).toBe('slack')
      );

      act(() => {
        result.current.notificationProps.setActions([
          MultipleCheckboxOptions.EMAIL,
          MultipleCheckboxOptions.INTEGRATION,
        ]);
        result.current.notificationProps.setChannel({
          label: '#eng',
          value: '#eng',
        });
      });

      act(() => {
        result.current.submit();
      });

      await waitFor(() => expect(onComplete).toHaveBeenCalled());

      const {projectDetailsForm: submittedForm} = onComplete.mock.calls[0][0];
      expect(submittedForm.notificationAction).toEqual({
        id: IssueAlertActionType.SLACK,
        workspace: slackIntegration.id,
        channel: '#eng',
      });
    });

    it('does not persist a notificationAction when alerts are turned off', async () => {
      const createdProject = ProjectFixture({slug: 'my-project', platform: 'python'});

      MockApiClient.addMockResponse({
        url: `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
        method: 'POST',
        body: createdProject,
      });

      const onComplete = jest.fn();
      const {result} = renderDetails({
        projectDetailsForm: {
          projectName: 'my-project',
          teamSlug: adminTeam.slug,
          alertRuleConfig: {
            ...DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
            alertSetting: RuleAction.CREATE_ALERT_LATER,
          },
        },
        onComplete,
      });

      // The integration checkbox stays selected in hook state even though the
      // notification picker is hidden while alerts are off.
      await waitFor(() =>
        expect(result.current.notificationProps.provider).toBe('slack')
      );
      act(() => {
        result.current.notificationProps.setActions([
          MultipleCheckboxOptions.EMAIL,
          MultipleCheckboxOptions.INTEGRATION,
        ]);
        result.current.notificationProps.setChannel({label: '#eng', value: '#eng'});
      });

      act(() => {
        result.current.submit();
      });

      await waitFor(() => expect(onComplete).toHaveBeenCalled());

      // No notification UI was shown, so the snapshot must not carry an action
      // (it would otherwise force the restore gate on a later visit).
      const {projectDetailsForm: submittedForm} = onComplete.mock.calls[0][0];
      expect(submittedForm.notificationAction).toBeUndefined();
    });

    it('restores provider/integration/channel from a persisted notificationAction', async () => {
      const persistedAction = {
        id: IssueAlertActionType.SLACK as const,
        workspace: slackIntegration.id,
        channel: '#restored',
      };

      const {result} = renderDetails({
        projectDetailsForm: {
          projectName: 'my-project',
          teamSlug: adminTeam.slug,
          notificationAction: persistedAction,
        },
      });

      await waitFor(() =>
        expect(result.current.notificationProps.provider).toBe('slack')
      );
      expect(result.current.notificationProps.integration?.id).toBe(slackIntegration.id);
      expect(result.current.notificationProps.channel?.value).toBe('#restored');
      expect(result.current.notificationProps.actions).toContain(
        MultipleCheckboxOptions.INTEGRATION
      );
    });

    it('reuses the project when the user returns with the same notification action', async () => {
      const existingProject = ProjectFixture({slug: 'my-project', platform: 'python'});
      ProjectsStore.loadInitialData([existingProject]);

      const persistedAction = {
        id: IssueAlertActionType.SLACK as const,
        workspace: slackIntegration.id,
        channel: '#eng',
      };

      const onComplete = jest.fn();
      const {result} = renderDetails({
        projectDetailsForm: {
          projectName: 'my-project',
          teamSlug: adminTeam.slug,
          // alertRuleConfig must match the in-use defaults so nothingChanged is true.
          alertRuleConfig: DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
          notificationAction: persistedAction,
        },
        createdProjectSlug: existingProject.slug,
        selectedPlatform: pythonPlatform,
        onComplete,
      });

      await waitFor(() =>
        expect(result.current.notificationProps.provider).toBe('slack')
      );

      // No change to the form; the project should be reused.
      act(() => {
        result.current.submit();
      });

      await waitFor(() => expect(onComplete).toHaveBeenCalled());
      expect(onComplete.mock.calls[0][0].project.slug).toBe(existingProject.slug);
    });

    it('blocks submit until the persisted notification selection is restored', async () => {
      const existingProject = ProjectFixture({slug: 'my-project', platform: 'python'});
      ProjectsStore.loadInitialData([existingProject]);

      const persistedAction = {
        id: IssueAlertActionType.SLACK as const,
        workspace: slackIntegration.id,
        channel: '#eng',
      };

      const createMock = MockApiClient.addMockResponse({
        url: `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
        method: 'POST',
        body: existingProject,
      });

      const onComplete = jest.fn();
      const {result} = renderDetails({
        projectDetailsForm: {
          projectName: 'my-project',
          teamSlug: adminTeam.slug,
          alertRuleConfig: DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
          notificationAction: persistedAction,
        },
        createdProjectSlug: existingProject.slug,
        selectedPlatform: pythonPlatform,
        onComplete,
      });

      // Before the messaging query resolves, the restore is pending: canSubmit
      // must be false so a premature click can't create a duplicate.
      expect(result.current.canSubmit).toBe(false);

      act(() => {
        result.current.submit();
      });

      // The submit bailed — no create POST, no completion.
      expect(createMock).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();

      // Once integrations load the restore settles: canSubmit becomes true.
      await waitFor(() =>
        expect(result.current.notificationProps.provider).toBe('slack')
      );
      expect(result.current.canSubmit).toBe(true);

      // Now submit reuses the existing project without a new create.
      act(() => {
        result.current.submit();
      });

      await waitFor(() => expect(onComplete).toHaveBeenCalled());
      expect(createMock).not.toHaveBeenCalled();
      expect(onComplete.mock.calls[0][0].project.slug).toBe(existingProject.slug);
    });

    it('keeps submit enabled after unchecking integration once restore settles', async () => {
      const existingProject = ProjectFixture({slug: 'my-project', platform: 'python'});
      ProjectsStore.loadInitialData([existingProject]);

      const persistedAction = {
        id: IssueAlertActionType.SLACK as const,
        workspace: slackIntegration.id,
        channel: '#eng',
      };

      const {result} = renderDetails({
        projectDetailsForm: {
          projectName: 'my-project',
          teamSlug: adminTeam.slug,
          alertRuleConfig: DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
          notificationAction: persistedAction,
        },
        createdProjectSlug: existingProject.slug,
        selectedPlatform: pythonPlatform,
      });

      // Restore settles: the gate opens.
      await waitFor(() =>
        expect(result.current.notificationProps.provider).toBe('slack')
      );
      expect(result.current.canSubmit).toBe(true);

      // Unchecking "notify via integration" drops INTEGRATION from actions.
      // The restore-complete latch must keep canSubmit true rather than wedging it.
      act(() => {
        result.current.notificationProps.setActions([MultipleCheckboxOptions.EMAIL]);
      });
      expect(result.current.canSubmit).toBe(true);
    });

    it('unblocks submit when the messaging query fails permanently', async () => {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/`,
        statusCode: 500,
        match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/`,
        body: organization,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/`,
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: [],
      });

      const persistedAction = {
        id: IssueAlertActionType.SLACK as const,
        workspace: slackIntegration.id,
        channel: '#eng',
      };

      const {result} = renderDetails({
        projectDetailsForm: {
          projectName: 'my-project',
          teamSlug: adminTeam.slug,
          alertRuleConfig: DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
          notificationAction: persistedAction,
        },
        selectedPlatform: pythonPlatform,
      });

      // Gate starts blocked while the query is in flight.
      expect(result.current.canSubmit).toBe(false);
      // After the query errors, the gate must release — the init effect never runs on
      // error so notificationPickerSettled stays false, but queryError is a standalone
      // escape hatch that bypasses that check.
      await waitFor(() => expect(result.current.canSubmit).toBe(true));
    });

    it('unblocks submit and falls back to email-only when saved integration is deleted', async () => {
      // The saved action points to workspace '999', which is not in the current
      // integration list (only slackIntegration with id '10' is present). This
      // simulates the integration being deleted after the form was first submitted.
      const persistedAction = {
        id: IssueAlertActionType.SLACK as const,
        workspace: '999',
        channel: '#eng',
      };

      const createdProject = ProjectFixture({slug: 'my-project', platform: 'python'});
      const createMock = MockApiClient.addMockResponse({
        url: `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
        method: 'POST',
        body: createdProject,
      });

      const onComplete = jest.fn();
      const {result} = renderDetails({
        projectDetailsForm: {
          projectName: 'my-project',
          teamSlug: adminTeam.slug,
          alertRuleConfig: DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
          notificationAction: persistedAction,
        },
        selectedPlatform: pythonPlatform,
        onComplete,
      });

      // Gate starts blocked while query is in flight.
      expect(result.current.canSubmit).toBe(false);

      // Once the query resolves and the picker shows the setup CTA (because the
      // saved integration is absent), the gate must release.
      await waitFor(() =>
        expect(result.current.notificationProps.shouldRenderSetupButton).toBe(true)
      );
      expect(result.current.canSubmit).toBe(true);

      // Submitting falls back to email-only: no messaging rule is created and
      // onComplete receives notificationAction === undefined.
      act(() => {
        result.current.submit();
      });

      await waitFor(() => expect(onComplete).toHaveBeenCalled());
      expect(createMock).toHaveBeenCalled();
      const {projectDetailsForm: submittedForm} = onComplete.mock.calls[0][0];
      expect(submittedForm.notificationAction).toBeUndefined();
    });

    it('creates a new project when the notification channel changes on return', async () => {
      const existingProject = ProjectFixture({slug: 'my-project', platform: 'python'});
      ProjectsStore.loadInitialData([existingProject]);

      const persistedAction = {
        id: IssueAlertActionType.SLACK as const,
        workspace: slackIntegration.id,
        channel: '#eng',
      };

      const createdProject = ProjectFixture({slug: 'my-project-v2', platform: 'python'});
      const createMock = MockApiClient.addMockResponse({
        url: `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
        method: 'POST',
        body: createdProject,
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${createdProject.slug}/rules/`,
        method: 'POST',
        body: {},
      });

      const onComplete = jest.fn();
      const {result} = renderDetails({
        projectDetailsForm: {
          projectName: 'my-project',
          teamSlug: adminTeam.slug,
          alertRuleConfig: DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
          notificationAction: persistedAction,
        },
        createdProjectSlug: existingProject.slug,
        selectedPlatform: pythonPlatform,
        onComplete,
      });

      await waitFor(() =>
        expect(result.current.notificationProps.provider).toBe('slack')
      );

      // User changes the channel, so the action differs from the saved one.
      act(() => {
        result.current.notificationProps.setChannel({
          label: '#different',
          value: '#different',
        });
      });

      act(() => {
        result.current.submit();
      });

      await waitFor(() => expect(onComplete).toHaveBeenCalled());
      expect(createMock).toHaveBeenCalled();
    });
  });
});
