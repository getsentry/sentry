import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {TeamFixture} from 'sentry-fixture/team';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';

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
    // ProjectsStore.onCreateSuccess reloads organization details.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      body: organization,
    });
  });

  afterEach(() => {
    TeamStore.reset();
    ProjectsStore.reset();
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
    // Slug and destination are persisted in one update, so a later reuse
    // check never sees a slug without the destination it was created for.
    expect(onCreatedProjectChange).toHaveBeenCalledWith({
      slug: 'python',
      messagingSelection: undefined,
    });
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({project: createdProject, reused: false, workflowIds: []})
    );
    // The created project must be persisted before completion so the
    // duplicate-prevention handoff to SDK setup survives a failure later in
    // the sequence.
    expect(onCreatedProjectChange.mock.invocationCallOrder[0]).toBeLessThan(
      onSuccess.mock.invocationCallOrder[0]!
    );
  });

  it('reuses the created project when the platform is unchanged', async () => {
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
      expect.objectContaining({project: createdProject, reused: true})
    );
  });

  it('creates a new project when the platform changed', async () => {
    const createRequest = mockCreateProject();
    ProjectsStore.loadInitialData([
      ProjectFixture({slug: 'old-project', platform: 'javascript'}),
    ]);
    const {result} = renderCreation({
      createdProject: {
        slug: 'old-project',
        messagingSelection: undefined,
      },
    });

    await act(() =>
      result.current.createOrReuseProject({
        platform: pythonPlatform,
        onSuccess: jest.fn(),
      })
    );

    expect(createRequest).toHaveBeenCalled();
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

  describe('messaging destination on reuse', () => {
    const savedSelection = {provider: 'slack', integrationId: '15', channel: '#alerts'};
    const reusableProject = {
      slug: createdProject.slug,
      messagingSelection: savedSelection,
    };

    beforeEach(() => {
      ProjectsStore.loadInitialData([createdProject]);
    });

    it('reuses the project when the staged destination is the one it was created for', async () => {
      const createRequest = mockCreateProject();
      const onSuccess = jest.fn();
      const {result} = renderCreation({createdProject: reusableProject});

      await act(() =>
        result.current.createOrReuseProject({
          platform: pythonPlatform,
          stagedSelection: savedSelection,
          onSuccess,
        })
      );

      expect(createRequest).not.toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({project: createdProject, reused: true})
      );
    });

    it('creates a new project when the staged destination changed', async () => {
      const createRequest = mockCreateProject();
      const onCreatedProjectChange = jest.fn();
      const onSuccess = jest.fn();
      const {result} = renderCreation({
        createdProject: reusableProject,
        onCreatedProjectChange,
      });
      const stagedSelection = {...savedSelection, channel: '#ops'};

      await act(() =>
        result.current.createOrReuseProject({
          platform: pythonPlatform,
          stagedSelection,
          onSuccess,
        })
      );

      expect(createRequest).toHaveBeenCalledTimes(1);
      expect(onCreatedProjectChange).toHaveBeenCalledWith({
        slug: createdProject.slug,
        messagingSelection: stagedSelection,
      });
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({reused: false}));
    });

    it('Set up later reuses the project whatever destination it was created for', async () => {
      const createRequest = mockCreateProject();
      const onSuccess = jest.fn();
      const {result} = renderCreation({createdProject: reusableProject});

      await act(() =>
        result.current.createOrReuseProject({platform: pythonPlatform, onSuccess})
      );

      expect(createRequest).not.toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({reused: true}));
    });
  });
});
