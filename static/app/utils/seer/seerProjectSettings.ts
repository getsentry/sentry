import {mutationOptions, type QueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import type {Organization} from 'sentry/types/organization';
import type {AvatarProject} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';

type SeerAutomationHandoffConfiguration = {
  auto_create_pr: boolean;
  handoff_point: 'root_cause';
  integration_id: number;
  target: 'cursor_background_agent' | 'claude_code_agent';
};

type SeerProjectSettings = {
  automation_tuning: string;
  handoff: SeerAutomationHandoffConfiguration | null;
  repos_count: number;
  scanner_automation: boolean;
  stopping_point: string;
};

type SeerProjectSettingsResponse = {
  agent: string;
  autoCreatePr: boolean | null;
  automationTuning: string;
  integrationId: string | null;
  projectId: string;
  projectSlug: string;
  reposCount: number;
  scannerAutomation: boolean;
  stoppingPoint: string;
};

export const seerProjectSettingsSchema = z.object({
  automation_tuning: z.enum(['off', 'low', 'medium', 'high']),
  handoff: z.object({
    auto_create_pr: z.boolean(),
    handoff_point: z.literal('root_cause'),
    integration_id: z.number(),
    target: z.enum(['cursor_background_agent', 'claude_code_agent']),
  }),
  repos_count: z.number(),
  scanner_automation: z.boolean(),
  stopping_point: z.string(),
});

export function getSeerProjectSettingsQueryOptions({
  organization,
  project,
}: {
  organization: Organization;
  project: AvatarProject;
}) {
  return apiOptions.as<SeerProjectSettingsResponse>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/seer/settings/',
    {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      staleTime: 60_000, // 1 minute
    }
  );
}

export function getMutateSeerProjectSettingsOptions({
  organization,
  project,
  queryClient,
}: {
  organization: Organization;
  project: AvatarProject;
  queryClient: QueryClient;
}) {
  const queryKey = getSeerProjectSettingsQueryOptions({organization, project}).queryKey;
  const [url] = queryKey;

  return mutationOptions({
    mutationFn: (data: Partial<SeerProjectSettings>) => {
      return fetchMutation<SeerProjectSettingsResponse>({
        method: 'PUT',
        url,
        data,
      });
    },
    onMutate: async _data => {
      await queryClient.cancelQueries({queryKey});
      const previousData = queryClient.getQueryData(queryKey);

      // TODO: Optimistically update the query cache? We need to convert some
      // values, if we have them
      //
      // queryClient.setQueryData(
      //   queryKey,
      //   (prev: ApiResponse<SeerProjectSettingsResponse> | undefined) =>
      //     prev
      //       ? {...prev, json: {...prev.json, ...data}}
      //       : {headers: {}, json: {...(data as SeerProjectSettingsResponse)}}
      // );

      return {previousData};
    },
    onError: (_error, _data, context) => {
      queryClient.setQueryData(queryKey, context?.previousData);
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey});
    },
  });
}
