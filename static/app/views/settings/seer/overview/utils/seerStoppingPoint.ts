import type {QueryClient} from '@tanstack/react-query';

import {updateOrganization} from 'sentry/actionCreators/organizations';
import {bulkAutofixAutomationSettingsInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {
  makeProjectSeerPreferencesQueryKey,
  type SeerPreferencesResponse,
} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {
  fetchMutation,
  getApiQueryData,
  mutationOptions,
  setApiQueryData,
} from 'sentry/utils/queryClient';
import {useFetchAgentOptions} from 'sentry/views/settings/seer/overview/utils/seerPreferredAgent';

type SelectValue = 'off' | 'root_cause' | 'code';
type SelectOptions = {label: string; value: SelectValue};

export function getDefaultStoppingPointValue(organization: Organization): SelectValue {
  if ([null, undefined, 'off'].includes(organization.defaultAutofixAutomationTuning)) {
    return 'off';
  }
  return organization.defaultAutomatedRunStoppingPoint === 'root_cause'
    ? 'root_cause'
    : 'code';
}

export function getProjectStoppingPointValue(
  project: Project,
  preference: ProjectSeerPreferences
): SelectValue {
  if ([null, undefined, 'off'].includes(project.autofixAutomationTuning)) {
    return 'off';
  }
  return preference.automated_run_stopping_point === 'root_cause' ? 'root_cause' : 'code';
}

export function useFetchStoppingPointOptions({
  organization,
  agent,
}: {
  agent: undefined | 'seer' | CodingAgentIntegration;
  organization: Organization;
}): SelectOptions[] {
  const autoOpenPrs = organization.autoOpenPrs;

  const isSeerAgent = agent === 'seer';
  const codingAgentSelectOptions = useFetchAgentOptions({
    organization,
    enabled: !isSeerAgent,
  });

  if (isSeerAgent) {
    return [
      {value: 'off', label: t('No Automation')},
      {value: 'root_cause', label: t('Automate Root Cause Analysis')},
      {
        value: 'code',
        label: autoOpenPrs
          ? t('Draft a Pull Request with Seer')
          : t('Write Code Changes with Seer'),
      },
    ];
  }

  const agentLabel = codingAgentSelectOptions.data?.find(
    o => o.value === agent || (typeof o.value === 'object' && o.value.id === agent?.id)
  )?.label;

  return [
    {value: 'off', label: t('No Automation')},
    {value: 'root_cause', label: t('Automate Root Cause Analysis')},
    {
      value: 'code',
      label: autoOpenPrs
        ? agentLabel
          ? t('Draft a Pull Request with %s', agentLabel)
          : t('Draft a Pull Request')
        : agentLabel
          ? t('Propose Changes with %s', agentLabel)
          : t('Propose Changes'),
    },
  ];
}

export function getDefaultStoppingPointMutationOptions({
  organization,
}: {
  organization: Organization;
}) {
  return mutationOptions({
    mutationFn: ({stoppingPoint}: {stoppingPoint: SelectValue}) => {
      return fetchMutation<Organization>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data:
          stoppingPoint === 'off'
            ? {defaultAutofixAutomationTuning: 'off'}
            : {
                defaultAutofixAutomationTuning: 'medium',
                defaultAutomatedRunStoppingPoint:
                  stoppingPoint === 'root_cause'
                    ? 'root_cause'
                    : organization.autoOpenPrs
                      ? 'open_pr'
                      : 'code_changes',
              },
      });
    },
    onSuccess: updateOrganization,
  });
}

export function getProjectStoppingPointMutationOptions({
  organization,
  preference,
  project,
  queryClient,
}: {
  organization: Organization;
  preference: ProjectSeerPreferences;
  project: Project;
  queryClient: QueryClient;
}) {
  const seerPrefsQueryKey = makeProjectSeerPreferencesQueryKey(
    organization.slug,
    project.slug
  );

  return mutationOptions({
    mutationFn: async ({stoppingPoint}: {stoppingPoint: SelectValue}) => {
      const tuning = stoppingPoint === 'off' ? ('off' as const) : ('medium' as const);

      const projectPromise = fetchMutation<Project>({
        method: 'PUT',
        url: `/projects/${organization.slug}/${project.slug}/`,
        data: {autofixAutomationTuning: tuning},
      });

      let preferencePromise: Promise<SeerPreferencesResponse | undefined> =
        Promise.resolve(undefined);
      if (stoppingPoint !== 'off') {
        const repositories = preference?.repositories ?? [];
        const automationHandoff = preference?.automation_handoff;

        const stoppingPointValue =
          stoppingPoint === 'root_cause'
            ? ('root_cause' as const)
            : organization.autoOpenPrs
              ? ('open_pr' as const)
              : ('code_changes' as const);

        const preferencePayload = {
          repositories,
          automated_run_stopping_point: stoppingPointValue,
          automation_handoff: automationHandoff
            ? {
                ...automationHandoff,
                auto_create_pr: stoppingPointValue === 'open_pr',
              }
            : automationHandoff,
        };

        preferencePromise = fetchMutation<SeerPreferencesResponse>({
          method: 'POST',
          url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
          data: preferencePayload as unknown as Record<string, unknown>,
        });
      }

      return await Promise.all([projectPromise, preferencePromise]);
    },
    onSuccess: ([updatedProject, preferencePayload]) => {
      ProjectsStore.onUpdateSuccess(updatedProject);

      if (preferencePayload) {
        const previous = getApiQueryData<SeerPreferencesResponse>(
          queryClient,
          seerPrefsQueryKey
        );
        if (previous) {
          setApiQueryData<SeerPreferencesResponse>(queryClient, seerPrefsQueryKey, {
            ...previous,
            preference: {
              repositories: [],
              ...previous.preference,
              ...preferencePayload.preference,
            },
          });
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: seerPrefsQueryKey});

      const bulkAutofixAutomationSettingsQueryOptions =
        bulkAutofixAutomationSettingsInfiniteOptions({
          organization,
        });
      queryClient.invalidateQueries({
        queryKey: bulkAutofixAutomationSettingsQueryOptions.queryKey,
      });
    },
  });
}
