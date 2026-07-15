import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {MultipleCheckboxOptions} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

import {useScmProjectDetails} from './useScmProjectDetails';

const pythonPlatform: OnboardingSelectedSDK = {
  key: 'python',
  name: 'Python',
  language: 'python',
  type: 'language',
  link: 'https://docs.sentry.io/platforms/python/',
  category: 'popular',
};

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
});
