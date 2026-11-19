import {AutomationFixture} from 'sentry-fixture/automations';
import {IssueStreamDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {TeamFixture} from 'sentry-fixture/team';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {getRequestDataFragment} from 'sentry/views/projectInstall/issueAlertOptions';
import {buildIntegrationAction} from 'sentry/views/projectInstall/messagingIntegrationTypes';

import {useScmProjectCreation} from './useScmProjectCreation';

const pythonPlatform: OnboardingSelectedSDK = {
  key: 'python',
  name: 'Python',
  language: 'python',
  type: 'language',
  link: 'https://docs.sentry.io/platforms/python/',
  category: 'popular',
};

describe('useScmProjectCreation', () => {
  const organization = OrganizationFixture();
  const adminTeam = TeamFixture({slug: 'admin-team', access: ['team:admin']});
  const createdProject = ProjectFixture({slug: 'python', platform: 'python'});

  function renderCreation(
    overrides: Partial<Parameters<typeof useScmProjectCreation>[0]> = {}
  ) {
    return renderHookWithProviders(
      () =>
        useScmProjectCreation({
          createdProject: undefined,
          onCreatedProjectChange: jest.fn(),
          selectedRepository: undefined,
          ...overrides,
        }),
      {organization}
    );
  }

  function mockCreateProject() {
    return MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
      method: 'POST',
      body: createdProject,
    });
  }

  beforeEach(() => {
    TeamStore.reset();
    TeamStore.loadInitialData([adminTeam]);
    ProjectsStore.loadInitialData([]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [adminTeam],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    // useCreateProject reloads organization details after creating a project.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      body: organization,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('creates the project with default rules and persists it before completing', async () => {
    const createRequest = mockCreateProject();
    const onCreatedProjectChange = jest.fn();
    const onSuccess = jest.fn();
    const {result} = renderCreation({onCreatedProjectChange});

    await act(() =>
      result.current.createOrReuseProject({platform: pythonPlatform, onSuccess})
    );

    expect(createRequest).toHaveBeenCalledWith(
      `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
      expect.objectContaining({
        method: 'POST',
        data: expect.objectContaining({
          platform: 'python',
          name: 'python',
          default_rules: true,
        }),
      })
    );
    expect(onCreatedProjectChange).toHaveBeenCalledWith({
      slug: 'python',
      messagingSelection: undefined,
    });
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        project: createdProject,
        outcome: 'created',
        workflowIds: [],
      })
    );
    // The created project must be persisted before completion so the
    // duplicate-prevention handoff to SDK setup survives a failure later in
    // the sequence.
    expect(onCreatedProjectChange.mock.invocationCallOrder[0]).toBeLessThan(
      onSuccess.mock.invocationCallOrder[0]!
    );
  });

  it('reuses the created project as-is when nothing changed', async () => {
    const createRequest = mockCreateProject();
    ProjectsStore.loadInitialData([createdProject]);
    const onSuccess = jest.fn();
    const {result} = renderCreation({
      createdProject: {
        slug: createdProject.slug,
        messagingSelection: undefined,
      },
    });

    await act(() =>
      result.current.createOrReuseProject({platform: pythonPlatform, onSuccess})
    );

    expect(createRequest).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({project: createdProject, outcome: 'unchanged'})
    );
  });

  describe('editing the created project when the platform changed', () => {
    const oldProject = ProjectFixture({
      id: '7',
      slug: 'javascript',
      name: 'javascript',
      platform: 'javascript',
      firstEvent: null,
    });
    const existing = {slug: oldProject.slug, messagingSelection: undefined};

    beforeEach(() => {
      ProjectsStore.loadInitialData([oldProject]);
    });

    function mockUpdateProject(body: Partial<typeof oldProject> = {}) {
      return MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${oldProject.slug}/`,
        method: 'PUT',
        body: {...oldProject, platform: 'python', ...body},
      });
    }

    it('sets the new platform on the same project instead of creating one', async () => {
      const createRequest = mockCreateProject();
      const updateRequest = mockUpdateProject({slug: 'python', name: 'python'});
      const onCreatedProjectChange = jest.fn();
      const onSuccess = jest.fn();
      const {result} = renderCreation({createdProject: existing, onCreatedProjectChange});

      await act(() =>
        result.current.createOrReuseProject({platform: pythonPlatform, onSuccess})
      );

      expect(createRequest).not.toHaveBeenCalled();
      // The name came from the old platform, so it follows the new one.
      expect(updateRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${oldProject.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {platform: 'python', name: 'python', slug: 'python'},
        })
      );
      expect(onCreatedProjectChange).toHaveBeenCalledWith({
        slug: 'python',
        messagingSelection: undefined,
      });
      expect(ProjectsStore.getById(oldProject.id)).toEqual(
        expect.objectContaining({slug: 'python', platform: 'python'})
      );
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'updated',
          project: expect.objectContaining({id: oldProject.id, platform: 'python'}),
          workflowIds: [],
        })
      );
    });

    it('keeps a name that came from the repository', async () => {
      const repoProject = {...oldProject, name: 'my-repo'};
      ProjectsStore.loadInitialData([repoProject]);
      const updateRequest = mockUpdateProject({name: 'my-repo'});
      const {result} = renderCreation({
        createdProject: existing,
        selectedRepository: RepositoryFixture({name: 'getsentry/my-repo'}),
      });

      await act(() =>
        result.current.createOrReuseProject({
          platform: pythonPlatform,
          onSuccess: jest.fn(),
        })
      );

      expect(updateRequest).toHaveBeenCalledTimes(1);
      expect(updateRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({data: {platform: 'python'}})
      );
    });

    it('still sets the platform when the rename is rejected', async () => {
      const renameRequest = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${oldProject.slug}/`,
        method: 'PUT',
        statusCode: 400,
        body: {slug: ['Another project (python) is already using that slug']},
        match: [MockApiClient.matchData({slug: 'python'})],
      });
      const platformRequest = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${oldProject.slug}/`,
        method: 'PUT',
        body: {...oldProject, platform: 'python'},
        match: [(_url, options) => !('slug' in (options.data ?? {}))],
      });
      const onCreatedProjectChange = jest.fn();
      const onSuccess = jest.fn();
      const {result} = renderCreation({createdProject: existing, onCreatedProjectChange});

      await act(() =>
        result.current.createOrReuseProject({platform: pythonPlatform, onSuccess})
      );

      expect(renameRequest).toHaveBeenCalledTimes(1);
      expect(platformRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({data: {platform: 'python'}})
      );
      expect(onCreatedProjectChange).toHaveBeenCalledWith({
        slug: oldProject.slug,
        messagingSelection: undefined,
      });
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({outcome: 'updated'})
      );
    });

    it('does not complete when the project cannot be updated', async () => {
      const createRequest = mockCreateProject();
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${oldProject.slug}/`,
        method: 'PUT',
        statusCode: 500,
        body: {},
      });
      const onCreatedProjectChange = jest.fn();
      const onSuccess = jest.fn();
      const {result} = renderCreation({createdProject: existing, onCreatedProjectChange});

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.createOrReuseProject({
          platform: pythonPlatform,
          onSuccess,
        });
      });

      expect(outcome).toBeUndefined();
      expect(createRequest).not.toHaveBeenCalled();
      expect(onCreatedProjectChange).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  it('creates a new project when the created one no longer exists', async () => {
    const createRequest = mockCreateProject();
    const onSuccess = jest.fn();
    const {result} = renderCreation({
      createdProject: {slug: 'deleted-project', messagingSelection: undefined},
    });

    await act(() =>
      result.current.createOrReuseProject({platform: pythonPlatform, onSuccess})
    );

    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({outcome: 'created'}));
  });

  it('creates at most one project for concurrent submissions', async () => {
    const createRequest = mockCreateProject();
    const {result} = renderCreation();

    await act(() =>
      Promise.all([
        result.current.createOrReuseProject({
          platform: pythonPlatform,
          onSuccess: jest.fn(),
        }),
        result.current.createOrReuseProject({
          platform: pythonPlatform,
          onSuccess: jest.fn(),
        }),
      ])
    );

    expect(createRequest).toHaveBeenCalledTimes(1);
  });

  it('completes even when best-effort repository linking fails', async () => {
    mockCreateProject();
    const repository = RepositoryFixture({id: '42'});
    const repoLinkRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${createdProject.slug}/repo/`,
      method: 'POST',
      statusCode: 500,
      body: {},
    });
    const onCreatedProjectChange = jest.fn();
    const onSuccess = jest.fn();
    const {result} = renderCreation({
      onCreatedProjectChange,
      selectedRepository: repository,
    });

    await act(() =>
      result.current.createOrReuseProject({platform: pythonPlatform, onSuccess})
    );

    expect(repoLinkRequest).toHaveBeenCalledWith(
      `/projects/${organization.slug}/${createdProject.slug}/repo/`,
      expect.objectContaining({method: 'POST', data: {repositoryId: '42'}})
    );
    // Persisted before the linking await: a reload during linking restores
    // the slug together with its destination.
    expect(onCreatedProjectChange.mock.invocationCallOrder[0]).toBeLessThan(
      repoLinkRequest.mock.invocationCallOrder[0]!
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it('does not complete when project creation fails', async () => {
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${adminTeam.slug}/projects/`,
      method: 'POST',
      statusCode: 400,
      body: {},
    });
    const onCreatedProjectChange = jest.fn();
    const onSuccess = jest.fn();
    const {result} = renderCreation({onCreatedProjectChange});

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.createOrReuseProject({
        platform: pythonPlatform,
        onSuccess,
      });
    });

    expect(outcome).toBeUndefined();
    expect(onCreatedProjectChange).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  describe('messaging destination', () => {
    const savedSelection = {provider: 'slack', integrationId: '15', channel: '#alerts'};
    const existing = {
      slug: createdProject.slug,
      messagingSelection: savedSelection,
    };
    const detector = IssueStreamDetectorFixture({
      id: 'detector-1',
      projectId: createdProject.id,
    });
    const getIntegrationAction = () =>
      buildIntegrationAction({provider: 'slack', integrationId: '15', channel: '#ops'});
    const alertRuleConfig = getRequestDataFragment();

    beforeEach(() => {
      ProjectsStore.loadInitialData([createdProject]);
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/`,
        body: [detector],
      });
    });

    function mockWorkflows() {
      const onboardingWorkflow = AutomationFixture({
        id: 'old-workflow',
        name: 'Send a notification for high priority issues',
        detectorIds: [detector.id],
      });
      // Same name, but shared with other detectors: never onboarding's.
      const sharedWorkflow = AutomationFixture({
        id: 'shared-workflow',
        name: 'Send a notification for high priority issues',
        detectorIds: [detector.id, 'other-detector'],
      });
      const handMadeWorkflow = AutomationFixture({
        id: 'hand-made-workflow',
        name: 'My alert',
        detectorIds: [detector.id],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/workflows/`,
        body: [onboardingWorkflow, sharedWorkflow, handMadeWorkflow],
      });
      const createWorkflowRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/workflows/`,
        method: 'POST',
        body: AutomationFixture({id: 'new-workflow'}),
      });
      const deleteRequests = [
        'old-workflow',
        'shared-workflow',
        'hand-made-workflow',
      ].map(id =>
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/workflows/${id}/`,
          method: 'DELETE',
        })
      );
      return {createWorkflowRequest, deleteRequests};
    }

    it('reuses the project as-is when the staged destination is the one it was created for', async () => {
      const createRequest = mockCreateProject();
      const onSuccess = jest.fn();
      const {result} = renderCreation({createdProject: existing});

      await act(() =>
        result.current.createOrReuseProject({
          platform: pythonPlatform,
          stagedSelection: savedSelection,
          onSuccess,
        })
      );

      expect(createRequest).not.toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({project: createdProject, outcome: 'unchanged'})
      );
    });

    it('replaces the onboarding workflow on the same project when the destination changed', async () => {
      const createRequest = mockCreateProject();
      const {createWorkflowRequest, deleteRequests} = mockWorkflows();
      const [oldDelete, sharedDelete, handMadeDelete] = deleteRequests;
      const onCreatedProjectChange = jest.fn();
      const onSuccess = jest.fn();
      const {result} = renderCreation({
        createdProject: existing,
        onCreatedProjectChange,
      });
      const stagedSelection = {...savedSelection, channel: '#ops'};

      await act(() =>
        result.current.createOrReuseProject({
          platform: pythonPlatform,
          alertRuleConfig,
          getIntegrationAction,
          stagedSelection,
          onSuccess,
        })
      );

      expect(createRequest).not.toHaveBeenCalled();
      expect(createWorkflowRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/workflows/`,
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Send a notification for high priority issues',
            detectorIds: [detector.id],
            actionFilters: [
              expect.objectContaining({
                actions: [
                  expect.objectContaining({type: 'email'}),
                  expect.objectContaining({type: 'slack', integrationId: '15'}),
                ],
              }),
            ],
          }),
        })
      );
      // Created before the old one is removed, so the project is never
      // without alerts.
      expect(oldDelete).toHaveBeenCalledTimes(1);
      expect(createWorkflowRequest.mock.invocationCallOrder[0]).toBeLessThan(
        oldDelete!.mock.invocationCallOrder[0]!
      );
      expect(sharedDelete).not.toHaveBeenCalled();
      expect(handMadeDelete).not.toHaveBeenCalled();
      expect(onCreatedProjectChange).toHaveBeenCalledWith({
        slug: createdProject.slug,
        messagingSelection: stagedSelection,
      });
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'updated',
          project: createdProject,
          workflowIds: ['new-workflow'],
          notificationRule: expect.objectContaining({id: 'new-workflow'}),
        })
      );
    });

    it('replaces the default email workflow when a destination is staged after Set up later', async () => {
      mockCreateProject();
      const {createWorkflowRequest, deleteRequests} = mockWorkflows();
      const onSuccess = jest.fn();
      const {result} = renderCreation({
        createdProject: {slug: createdProject.slug, messagingSelection: undefined},
      });

      await act(() =>
        result.current.createOrReuseProject({
          platform: pythonPlatform,
          alertRuleConfig,
          getIntegrationAction,
          stagedSelection: savedSelection,
          onSuccess,
        })
      );

      expect(createWorkflowRequest).toHaveBeenCalledTimes(1);
      expect(deleteRequests[0]).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({outcome: 'updated'})
      );
    });

    it('keeps the old workflow and does not complete when the new one cannot be created', async () => {
      const {deleteRequests} = mockWorkflows();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/workflows/`,
        method: 'POST',
        statusCode: 400,
        body: {},
      });
      const onCreatedProjectChange = jest.fn();
      const onSuccess = jest.fn();
      const {result} = renderCreation({
        createdProject: existing,
        onCreatedProjectChange,
      });

      await act(() =>
        result.current.createOrReuseProject({
          platform: pythonPlatform,
          alertRuleConfig,
          getIntegrationAction,
          stagedSelection: {...savedSelection, channel: '#ops'},
          onSuccess,
        })
      );

      expect(deleteRequests[0]).not.toHaveBeenCalled();
      expect(onCreatedProjectChange).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('Set up later reuses the project whatever destination it was created for', async () => {
      const createRequest = mockCreateProject();
      const onSuccess = jest.fn();
      const {result} = renderCreation({createdProject: existing});

      await act(() =>
        result.current.createOrReuseProject({platform: pythonPlatform, onSuccess})
      );

      expect(createRequest).not.toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({outcome: 'unchanged'})
      );
    });
  });
});
