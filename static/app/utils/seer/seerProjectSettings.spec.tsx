import type {ReactNode} from 'react';
import {QueryClientProvider, useMutation} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {
  getMutateSeerProjectSettingsOptions,
  getSeerProjectSettingsQueryOptions,
} from 'sentry/utils/seer/seerProjectSettings';
import type {SeerProjectSettingsResponse} from 'sentry/utils/seer/types';

const organization = OrganizationFixture({slug: 'org-slug'});
const project = {slug: 'project-slug'};

const knownAgents: CodingAgentIntegration[] = [
  {id: '123', name: 'Cursor', provider: 'cursor'},
  {id: '456', name: 'Claude Code', provider: 'claude_code'},
];

function makeResponseFixture(
  overrides?: Partial<SeerProjectSettingsResponse>
): SeerProjectSettingsResponse {
  return {
    agent: 'seer',
    autoCreatePr: null,
    automationTuning: 'medium',
    integrationId: null,
    projectId: '1',
    projectSlug: 'project-slug',
    reposCount: 1,
    scannerAutomation: false,
    stoppingPoint: 'root_cause',
    ...overrides,
  };
}

const settingsUrl = `/projects/${organization.slug}/${project.slug}/seer/settings/`;

describe('getMutateSeerProjectSettingsOptions', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  function renderMutationHook({agents}: {agents?: CodingAgentIntegration[]} = {}) {
    const queryClient = makeTestQueryClient();

    const queryKey = getSeerProjectSettingsQueryOptions({
      organization,
      project,
    }).queryKey;

    queryClient.setQueryData(queryKey, {
      headers: {},
      json: makeResponseFixture(),
    });

    const hook = renderHookWithProviders(
      () =>
        useMutation(
          getMutateSeerProjectSettingsOptions({
            organization,
            project,
            queryClient,
            knownAgents: agents,
          })
        ),
      {
        organization,
        additionalWrapper: ({children}: {children?: ReactNode}) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    );

    return {queryClient, queryKey, ...hook};
  }

  describe('agent mutations', () => {
    it('sends agent without integrationId for seer', async () => {
      const mock = MockApiClient.addMockResponse({
        url: settingsUrl,
        method: 'PUT',
        body: makeResponseFixture(),
      });

      const {result} = renderMutationHook({agents: knownAgents});

      await act(async () => {
        await result.current.mutateAsync({agent: 'seer'});
      });

      expect(mock).toHaveBeenCalledWith(
        settingsUrl,
        expect.objectContaining({
          method: 'PUT',
          data: {agent: 'seer'},
        })
      );
    });

    it('sends integrationId for cursor_background_agent', async () => {
      const mock = MockApiClient.addMockResponse({
        url: settingsUrl,
        method: 'PUT',
        body: makeResponseFixture({
          agent: 'cursor_background_agent',
          integrationId: '123',
        }),
      });

      const {result} = renderMutationHook({agents: knownAgents});

      await act(async () => {
        await result.current.mutateAsync({agent: 'cursor_background_agent'});
      });

      expect(mock).toHaveBeenCalledWith(
        settingsUrl,
        expect.objectContaining({
          method: 'PUT',
          data: {agent: 'cursor_background_agent', integrationId: '123'},
        })
      );
    });

    it('sends integrationId for claude_code_agent', async () => {
      const mock = MockApiClient.addMockResponse({
        url: settingsUrl,
        method: 'PUT',
        body: makeResponseFixture({
          agent: 'claude_code_agent',
          integrationId: '456',
        }),
      });

      const {result} = renderMutationHook({agents: knownAgents});

      await act(async () => {
        await result.current.mutateAsync({agent: 'claude_code_agent'});
      });

      expect(mock).toHaveBeenCalledWith(
        settingsUrl,
        expect.objectContaining({
          method: 'PUT',
          data: {agent: 'claude_code_agent', integrationId: '456'},
        })
      );
    });

    it('does not send integrationId when knownAgents is not provided', async () => {
      const mock = MockApiClient.addMockResponse({
        url: settingsUrl,
        method: 'PUT',
        body: makeResponseFixture({agent: 'cursor_background_agent'}),
      });

      const {result} = renderMutationHook();

      await act(async () => {
        await result.current.mutateAsync({agent: 'cursor_background_agent'});
      });

      expect(mock).toHaveBeenCalledWith(
        settingsUrl,
        expect.objectContaining({
          method: 'PUT',
          data: {agent: 'cursor_background_agent'},
        })
      );
    });
  });

  describe('stopping point mutations', () => {
    it('sends only automation_tuning=off when stopping_point=off', async () => {
      const mock = MockApiClient.addMockResponse({
        url: settingsUrl,
        method: 'PUT',
        body: makeResponseFixture({stoppingPoint: 'off', automationTuning: 'off'}),
      });

      const {result} = renderMutationHook();

      await act(async () => {
        await result.current.mutateAsync({stopping_point: 'off'});
      });

      expect(mock).toHaveBeenCalledWith(
        settingsUrl,
        expect.objectContaining({
          method: 'PUT',
          data: {automation_tuning: 'off'},
        })
      );
    });

    it('sends automation_tuning=medium when stopping_point=root_cause', async () => {
      const mock = MockApiClient.addMockResponse({
        url: settingsUrl,
        method: 'PUT',
        body: makeResponseFixture({stoppingPoint: 'root_cause'}),
      });

      const {result} = renderMutationHook();

      await act(async () => {
        await result.current.mutateAsync({stopping_point: 'root_cause'});
      });

      expect(mock).toHaveBeenCalledWith(
        settingsUrl,
        expect.objectContaining({
          method: 'PUT',
          data: {stopping_point: 'root_cause', automation_tuning: 'medium'},
        })
      );
    });

    it('sends automation_tuning=medium when stopping_point=plan', async () => {
      const mock = MockApiClient.addMockResponse({
        url: settingsUrl,
        method: 'PUT',
        body: makeResponseFixture({stoppingPoint: 'solution'}),
      });

      const {result} = renderMutationHook();

      await act(async () => {
        await result.current.mutateAsync({stopping_point: 'plan'});
      });

      expect(mock).toHaveBeenCalledWith(
        settingsUrl,
        expect.objectContaining({
          method: 'PUT',
          data: {stopping_point: 'plan', automation_tuning: 'medium'},
        })
      );
    });

    it('sends automation_tuning=medium when stopping_point=create_pr', async () => {
      const mock = MockApiClient.addMockResponse({
        url: settingsUrl,
        method: 'PUT',
        body: makeResponseFixture({stoppingPoint: 'code_changes'}),
      });

      const {result} = renderMutationHook();

      await act(async () => {
        await result.current.mutateAsync({stopping_point: 'create_pr'});
      });

      expect(mock).toHaveBeenCalledWith(
        settingsUrl,
        expect.objectContaining({
          method: 'PUT',
          data: {stopping_point: 'create_pr', automation_tuning: 'medium'},
        })
      );
    });

    it('does not send automation_tuning when stopping_point is not provided', async () => {
      const mock = MockApiClient.addMockResponse({
        url: settingsUrl,
        method: 'PUT',
        body: makeResponseFixture(),
      });

      const {result} = renderMutationHook();

      await act(async () => {
        await result.current.mutateAsync({agent: 'seer'});
      });

      expect(mock).toHaveBeenCalledWith(
        settingsUrl,
        expect.objectContaining({
          method: 'PUT',
          data: {agent: 'seer'},
        })
      );
    });
  });

  describe('optimistic updates', () => {
    it('optimistically updates agent and integrationId in cache', async () => {
      MockApiClient.addMockResponse({
        url: settingsUrl,
        method: 'PUT',
        body: makeResponseFixture({
          agent: 'cursor_background_agent',
          integrationId: '123',
        }),
      });

      const {result, queryClient, queryKey} = renderMutationHook({
        agents: knownAgents,
      });

      await act(async () => {
        await result.current.mutateAsync({agent: 'cursor_background_agent'});
      });

      await waitFor(() => {
        const cached = queryClient.getQueryData(queryKey);
        expect(cached?.json).toMatchObject({
          agent: 'cursor_background_agent',
          integrationId: '123',
        });
      });
    });

    it('optimistically sets integrationId to null for seer', async () => {
      const queryClient = makeTestQueryClient();
      const queryKey = getSeerProjectSettingsQueryOptions({
        organization,
        project,
      }).queryKey;

      queryClient.setQueryData(queryKey, {
        headers: {},
        json: makeResponseFixture({
          agent: 'cursor_background_agent',
          integrationId: '123',
        }),
      });

      MockApiClient.addMockResponse({
        url: settingsUrl,
        method: 'PUT',
        body: makeResponseFixture(),
      });

      const {result} = renderHookWithProviders(
        () =>
          useMutation(
            getMutateSeerProjectSettingsOptions({
              organization,
              project,
              queryClient,
              knownAgents,
            })
          ),
        {
          organization,
          additionalWrapper: ({children}: {children?: ReactNode}) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          ),
        }
      );

      await act(async () => {
        await result.current.mutateAsync({agent: 'seer'});
      });

      await waitFor(() => {
        const cached = queryClient.getQueryData(queryKey);
        expect(cached?.json).toMatchObject({
          agent: 'seer',
          integrationId: null,
        });
      });
    });

    it('optimistically updates stoppingPoint and automationTuning', async () => {
      MockApiClient.addMockResponse({
        url: settingsUrl,
        method: 'PUT',
        body: makeResponseFixture({stoppingPoint: 'off', automationTuning: 'off'}),
      });

      const {result, queryClient, queryKey} = renderMutationHook();

      await act(async () => {
        await result.current.mutateAsync({stopping_point: 'off'});
      });

      await waitFor(() => {
        const cached = queryClient.getQueryData(queryKey);
        expect(cached?.json).toMatchObject({
          stoppingPoint: 'off',
          automationTuning: 'off',
        });
      });
    });

    it('rolls back cache on error', async () => {
      MockApiClient.addMockResponse({
        url: settingsUrl,
        method: 'PUT',
        statusCode: 500,
        body: {detail: 'Internal Error'},
      });

      const {result, queryClient, queryKey} = renderMutationHook({
        agents: knownAgents,
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({agent: 'cursor_background_agent'});
        } catch {
          // expected
        }
      });

      await waitFor(() => {
        const cached = queryClient.getQueryData(queryKey);
        expect(cached?.json).toMatchObject({
          agent: 'seer',
          integrationId: null,
        });
      });
    });
  });
});
