import {useEffect} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import ProjectsStore from 'sentry/stores/projectsStore';

import {
  useAgentOptions,
  useMutateSelectedAgent,
  useSelectedAgent,
} from 'getsentry/views/seerAutomation/components/projectDetails/useAgentHooks';

function MutateSelectedAgentHarness({
  preference,
  project,
  mutateRef,
}: {
  mutateRef: React.MutableRefObject<
    | ((
        integration: 'seer' | 'none' | CodingAgentIntegration,
        options: {onError?: (error: Error) => void; onSuccess?: () => void}
      ) => void)
    | null
  >;
  preference: ProjectSeerPreferences;
  project: ReturnType<typeof ProjectFixture>;
}) {
  const mutate = useMutateSelectedAgent({preference, project});
  useEffect(() => {
    mutateRef.current = mutate;
    return () => {
      mutateRef.current = null;
    };
  }, [mutate, mutateRef]);
  return null;
}

describe('useAgentHooks', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});
  const project = ProjectFixture({slug: 'project-slug', id: '1'});

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.resetAllMocks();
    ProjectsStore.reset();
  });

  describe('useAgentOptions', () => {
    it('returns Seer, integration options, and Manual Agent Selection', () => {
      const integrations: CodingAgentIntegration[] = [
        {id: '42', name: 'Cursor', provider: 'cursor'},
      ];
      let options: ReturnType<typeof useAgentOptions> = [];

      function Test() {
        options = useAgentOptions({integrations});
        return null;
      }
      render(<Test />, {organization});
      expect(options).toHaveLength(3);
      expect(options[0]).toEqual({value: 'seer', label: expect.any(String)});
      expect(options[1]).toMatchObject({
        value: {id: '42', name: 'Cursor', provider: 'cursor'},
        label: 'Cursor (42)',
      });
      expect(options[2]).toEqual({value: 'none', label: expect.any(String)});
    });

    it('filters out integrations without id', () => {
      const integrations: CodingAgentIntegration[] = [
        {id: null, name: 'No Id', provider: 'other'},
        {id: '1', name: 'With Id', provider: 'cursor'},
      ];
      let options: ReturnType<typeof useAgentOptions> = [];

      function Test() {
        options = useAgentOptions({integrations});
        return null;
      }
      render(<Test />, {organization});
      expect(options).toHaveLength(3);
      expect(options[1].value).toMatchObject({id: '1', name: 'With Id'});
    });
  });

  describe('useSelectedAgent', () => {
    it('returns "none" when project autofixAutomationTuning is off', () => {
      const p = ProjectFixture({...project, autofixAutomationTuning: 'off'});
      let selected: ReturnType<typeof useSelectedAgent> = null;

      function Test() {
        selected = useSelectedAgent({
          preference: {},
          project: p,
          integrations: [],
        });
        return null;
      }
      render(<Test />, {organization});
      expect(selected).toBe('none');
    });

    it('returns "seer" when no automation_handoff integration_id', () => {
      let selected: ReturnType<typeof useSelectedAgent> = null;

      function Test() {
        selected = useSelectedAgent({
          preference: {},
          project,
          integrations: [],
        });
        return null;
      }
      render(<Test />, {organization});
      expect(selected).toBe('seer');
    });

    it('returns matching integration when automation_handoff has integration_id', () => {
      const integrations: CodingAgentIntegration[] = [
        {id: '99', name: 'Cursor', provider: 'cursor'},
      ];
      let selected: ReturnType<typeof useSelectedAgent> = null;

      function Test() {
        selected = useSelectedAgent({
          preference: {automation_handoff: {integration_id: 99}},
          project,
          integrations,
        });
        return null;
      }
      render(<Test />, {organization});
      expect(selected).toMatchObject({id: '99', name: 'Cursor'});
    });
  });

  describe('useMutateSelectedAgent', () => {
    const basePreference: ProjectSeerPreferences = {
      repositories: [],
      automated_run_stopping_point: 'code_changes',
      automation_handoff: undefined,
    };

    function setupMocks() {
      const projectPutRequest = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/`,
        method: 'PUT',
        body: project,
      });
      const seerPreferencesPostRequest = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        method: 'POST',
        body: {},
      });
      return {projectPutRequest, seerPreferencesPostRequest};
    }

    it('sends correct API requests when integration is "seer"', async () => {
      const {projectPutRequest, seerPreferencesPostRequest} = setupMocks();
      const mutateRef = {current: null as ReturnType<typeof useMutateSelectedAgent>};

      render(
        <MutateSelectedAgentHarness
          preference={basePreference}
          project={project}
          mutateRef={mutateRef}
        />,
        {organization}
      );

      act(() => {
        mutateRef.current!('seer', {});
      });

      await waitFor(() => {
        expect(projectPutRequest).toHaveBeenCalledTimes(1);
      });
      expect(projectPutRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {autofixAutomationTuning: 'medium'},
        })
      );

      expect(seerPreferencesPostRequest).toHaveBeenCalledTimes(1);
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            repositories: [],
            automated_run_stopping_point: 'code_changes',
            automation_handoff: undefined,
          }),
        })
      );
    });

    it('sends correct API requests when integration is "none"', async () => {
      const {projectPutRequest, seerPreferencesPostRequest} = setupMocks();
      const mutateRef = {current: null as ReturnType<typeof useMutateSelectedAgent>};

      render(
        <MutateSelectedAgentHarness
          preference={basePreference}
          project={project}
          mutateRef={mutateRef}
        />,
        {organization}
      );

      act(() => {
        mutateRef.current!('none', {});
      });

      await waitFor(() => {
        expect(projectPutRequest).toHaveBeenCalledTimes(1);
      });
      expect(projectPutRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {autofixAutomationTuning: 'off'},
        })
      );

      expect(seerPreferencesPostRequest).toHaveBeenCalledTimes(1);
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            repositories: [],
            automated_run_stopping_point: 'code_changes',
            automation_handoff: undefined,
          }),
        })
      );
    });

    it('sends correct API requests when integration is a CodingAgentIntegration', async () => {
      const {projectPutRequest, seerPreferencesPostRequest} = setupMocks();
      const mutateRef = {current: null as ReturnType<typeof useMutateSelectedAgent>};
      const integration: CodingAgentIntegration = {
        id: '123',
        name: 'Cursor',
        provider: 'cursor',
      };

      render(
        <MutateSelectedAgentHarness
          preference={basePreference}
          project={project}
          mutateRef={mutateRef}
        />,
        {organization}
      );

      act(() => {
        mutateRef.current!(integration, {});
      });

      await waitFor(() => {
        expect(projectPutRequest).toHaveBeenCalledTimes(1);
      });
      expect(projectPutRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {autofixAutomationTuning: 'medium'},
        })
      );

      expect(seerPreferencesPostRequest).toHaveBeenCalledTimes(1);
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            repositories: [],
            automated_run_stopping_point: 'code_changes',
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent',
              integration_id: 123,
              auto_create_pr: false,
            },
          }),
        })
      );
    });

    it('sets auto_create_pr from preference when integration is CodingAgentIntegration and stopping point is open_pr', async () => {
      const {seerPreferencesPostRequest} = setupMocks();
      const mutateRef = {current: null as ReturnType<typeof useMutateSelectedAgent>};
      const integration: CodingAgentIntegration = {
        id: '456',
        name: 'Cursor',
        provider: 'cursor',
      };
      const preferenceWithOpenPr: ProjectSeerPreferences = {
        ...basePreference,
        automated_run_stopping_point: 'open_pr',
      };

      render(
        <MutateSelectedAgentHarness
          preference={preferenceWithOpenPr}
          project={project}
          mutateRef={mutateRef}
        />,
        {organization}
      );

      act(() => {
        mutateRef.current!(integration, {});
      });

      await waitFor(() => {
        expect(seerPreferencesPostRequest).toHaveBeenCalledTimes(1);
      });
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        expect.objectContaining({
          data: expect.objectContaining({
            automation_handoff: expect.objectContaining({
              integration_id: 456,
              auto_create_pr: true,
            }),
          }),
        })
      );
    });

    it('passes through preference repositories and automated_run_stopping_point for all integration types', async () => {
      const {seerPreferencesPostRequest} = setupMocks();
      const mutateRef = {current: null as ReturnType<typeof useMutateSelectedAgent>};
      const preferenceWithRepos: ProjectSeerPreferences = {
        repositories: [{id: 'repo-1', name: 'my-repo'}],
        automated_run_stopping_point: 'open_pr',
        automation_handoff: undefined,
      };

      render(
        <MutateSelectedAgentHarness
          preference={preferenceWithRepos}
          project={project}
          mutateRef={mutateRef}
        />,
        {organization}
      );

      act(() => {
        mutateRef.current!('seer', {});
      });

      await waitFor(() => {
        expect(seerPreferencesPostRequest).toHaveBeenCalledTimes(1);
      });
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        expect.objectContaining({
          data: expect.objectContaining({
            repositories: [{id: 'repo-1', name: 'my-repo'}],
            automated_run_stopping_point: 'open_pr',
          }),
        })
      );
    });

    it('calls onSuccess when both requests succeed', async () => {
      setupMocks();
      const mutateRef = {current: null as ReturnType<typeof useMutateSelectedAgent>};
      const onSuccess = jest.fn();

      render(
        <MutateSelectedAgentHarness
          preference={basePreference}
          project={project}
          mutateRef={mutateRef}
        />,
        {organization}
      );

      act(() => {
        mutateRef.current!('seer', {onSuccess});
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('calls onError when a request fails', async () => {
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/`,
        method: 'PUT',
        statusCode: 500,
        body: {},
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        method: 'POST',
        body: {},
      });
      const mutateRef = {current: null as ReturnType<typeof useMutateSelectedAgent>};
      const onError = jest.fn();

      render(
        <MutateSelectedAgentHarness
          preference={basePreference}
          project={project}
          mutateRef={mutateRef}
        />,
        {organization}
      );

      act(() => {
        mutateRef.current!('seer', {onError});
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });
});
