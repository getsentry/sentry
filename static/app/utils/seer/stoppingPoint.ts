import type {QueryClient, UseMutateFunction} from '@tanstack/react-query';

import {
  bulkAutofixAutomationSettingsInfiniteOptions,
  type AutofixAutomationSettings,
} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {
  makeProjectSeerPreferencesQueryKey,
  type SeerPreferencesResponse,
} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {
  fetchDataQuery,
  fetchMutation,
  getApiQueryData,
  mutationOptions,
  setApiQueryData,
} from 'sentry/utils/queryClient';

type UserFacingStoppingPoint = 'off' | 'root_cause' | 'plan' | 'create_pr';

export const PROJECT_STOPPING_POINT_OPTIONS = [
  {value: 'off' as const, label: t('No Automation')},
  {value: 'root_cause' as const, label: t('Stop after Root Cause')},
  {value: 'plan' as const, label: t('Stop after Plan')},
  {value: 'create_pr' as const, label: t('Stop after PR drafted')},
];

export const PROJECT_STOPPING_POINT_SORT_ORDER: Record<UserFacingStoppingPoint, number> =
  {
    off: 1,
    root_cause: 2,
    plan: 3,
    create_pr: 4,
  };

/**
 * Derives the current stopping point UI value from project + preferences.
 *
 * Note that 'create_pr' is stored differently depending on the agent:
 *   - Seer agent: automated_run_stopping_point === 'open_pr'
 *   - External agent: automation_handoff.auto_create_pr === true
 */
export function getProjectStoppingPointValueFromSettings(
  settings: AutofixAutomationSettings | null | undefined
): UserFacingStoppingPoint {
  if (!settings?.autofixAutomationTuning || settings.autofixAutomationTuning === 'off') {
    return 'off';
  }
  if (settings?.automatedRunStoppingPoint === 'root_cause') {
    return 'root_cause';
  }
  if (
    settings?.automatedRunStoppingPoint === 'open_pr' ||
    settings?.automationHandoff?.auto_create_pr
  ) {
    return 'create_pr';
  }
  return 'plan';
}

/**
 * Derives the current stopping point UI value from project + preferences.
 *
 * Note that 'create_pr' is stored differently depending on the agent:
 *   - Seer agent: automated_run_stopping_point === 'open_pr'
 *   - External agent: automation_handoff.auto_create_pr === true
 */
export function getProjectStoppingPointValue(
  project: Project,
  preference: ProjectSeerPreferences | null | undefined
): UserFacingStoppingPoint {
  if (!project.autofixAutomationTuning || project.autofixAutomationTuning === 'off') {
    return 'off';
  }
  if (preference?.automated_run_stopping_point === 'root_cause') {
    return 'root_cause';
  }
  if (
    preference?.automated_run_stopping_point === 'open_pr' ||
    preference?.automation_handoff?.auto_create_pr
  ) {
    return 'create_pr';
  }
  return 'plan';
}

/**
 * Returns mutation options for updating the stopping point on a project.
 *
 * The 'create_pr' value is handled differently per agent type:
 *   - Seer: sets automated_run_stopping_point to 'open_pr'
 *   - External: sets automation_handoff.auto_create_pr = true, stopping point stays 'code_changes'
 *
 * Setting 'off' only writes autofixAutomationTuning and intentionally leaves
 * automated_run_stopping_point unchanged, so re-enabling restores the prior state.
 */
function resolveStoppingPoint(
  stoppingPoint: UserFacingStoppingPoint,
  handoff: ProjectSeerPreferences['automation_handoff']
): {
  automationHandoff: ProjectSeerPreferences['automation_handoff'];
  stoppingPointValue: ProjectSeerPreferences['automated_run_stopping_point'];
} {
  switch (stoppingPoint) {
    case 'create_pr':
      return {
        stoppingPointValue: 'open_pr',
        automationHandoff: handoff ? {...handoff, auto_create_pr: true} : undefined,
      };
    case 'plan':
      return {
        stoppingPointValue: 'code_changes',
        automationHandoff: handoff ? {...handoff, auto_create_pr: false} : undefined,
      };
    case 'root_cause':
      return {
        stoppingPointValue: 'root_cause',
        automationHandoff: handoff ? {...handoff, auto_create_pr: false} : undefined,
      };
    default:
      return {
        stoppingPointValue: undefined,
        automationHandoff: handoff ? {...handoff, auto_create_pr: false} : undefined,
      };
  }
}

type StoppingPointVariables = {
  project: Project;
  stoppingPoint: UserFacingStoppingPoint;
};

export type MutateStoppingPoint = UseMutateFunction<
  [Project, SeerPreferencesResponse | undefined],
  unknown,
  StoppingPointVariables
>;

export function getProjectStoppingPointMutationOptions({
  organization,
  queryClient,
}: {
  organization: Organization;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationFn: async ({stoppingPoint, project}: StoppingPointVariables) => {
      const tuning = stoppingPoint === 'off' ? ('off' as const) : ('medium' as const);

      const projectPromise = fetchMutation<Project>({
        method: 'PUT',
        url: `/projects/${organization.slug}/${project.slug}/`,
        data: {autofixAutomationTuning: tuning},
      });

      if (stoppingPoint === 'off') {
        return Promise.all([projectPromise, Promise.resolve(undefined)]);
      }

      const seerPrefsQueryKey = makeProjectSeerPreferencesQueryKey(
        organization.slug,
        project.slug
      );
      const [prefsData] = await queryClient.fetchQuery({
        queryKey: seerPrefsQueryKey,
        queryFn: fetchDataQuery<SeerPreferencesResponse>,
        staleTime: 0,
      });
      const preference = prefsData?.preference;

      const {stoppingPointValue, automationHandoff} = resolveStoppingPoint(
        stoppingPoint,
        preference?.automation_handoff
      );

      const preferencesPromise = fetchMutation<SeerPreferencesResponse>({
        method: 'POST',
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        data: {
          repositories: preference?.repositories ?? [],
          automated_run_stopping_point: stoppingPointValue,
          automation_handoff: automationHandoff,
        },
      });

      return Promise.all([projectPromise, preferencesPromise]);
    },
    onMutate: ({stoppingPoint, project}: StoppingPointVariables) => {
      const seerPrefsQueryKey = makeProjectSeerPreferencesQueryKey(
        organization.slug,
        project.slug
      );
      const previousProject = ProjectsStore.getById(project.id);
      const previousPreference = getApiQueryData<SeerPreferencesResponse>(
        queryClient,
        seerPrefsQueryKey
      );

      const tuning = stoppingPoint === 'off' ? ('off' as const) : ('medium' as const);
      ProjectsStore.onUpdateSuccess({...project, autofixAutomationTuning: tuning});

      const bulkQueryKey = bulkAutofixAutomationSettingsInfiniteOptions({
        organization,
      }).queryKey;
      const previousBulkData = queryClient.getQueryData(bulkQueryKey);

      const bulkUpdates: Partial<AutofixAutomationSettings> = {
        autofixAutomationTuning: tuning,
      };

      if (stoppingPoint !== 'off' && previousPreference?.preference) {
        const {stoppingPointValue, automationHandoff} = resolveStoppingPoint(
          stoppingPoint,
          previousPreference.preference.automation_handoff
        );
        setApiQueryData<SeerPreferencesResponse>(queryClient, seerPrefsQueryKey, {
          ...previousPreference,
          preference: {
            ...previousPreference.preference,
            automated_run_stopping_point: stoppingPointValue,
            automation_handoff: automationHandoff,
          },
        });
        bulkUpdates.automatedRunStoppingPoint = stoppingPointValue;
        bulkUpdates.automationHandoff = automationHandoff;
      }

      queryClient.setQueryData(bulkQueryKey, (oldData: typeof previousBulkData) => {
        if (!oldData) {
          return oldData;
        }
        return {
          ...oldData,
          pages: oldData.pages.map(page => ({
            ...page,
            json: page.json.map(setting =>
              String(setting.projectId) === project.id
                ? {...setting, ...bulkUpdates}
                : setting
            ),
          })),
        };
      });

      return {previousProject, previousPreference, previousBulkData};
    },
    onError: (_error, {project}: StoppingPointVariables, context) => {
      if (context?.previousProject) {
        ProjectsStore.onUpdateSuccess(context.previousProject);
      }
      if (context?.previousPreference) {
        const seerPrefsQueryKey = makeProjectSeerPreferencesQueryKey(
          organization.slug,
          project.slug
        );
        setApiQueryData<SeerPreferencesResponse>(
          queryClient,
          seerPrefsQueryKey,
          context.previousPreference
        );
      }
      if (context?.previousBulkData) {
        const bulkQueryKey = bulkAutofixAutomationSettingsInfiniteOptions({
          organization,
        }).queryKey;
        queryClient.setQueryData(bulkQueryKey, context.previousBulkData);
      }
    },
    onSettled: (_data: unknown, _error: unknown, {project}: StoppingPointVariables) => {
      const seerPrefsQueryKey = makeProjectSeerPreferencesQueryKey(
        organization.slug,
        project.slug
      );
      queryClient.invalidateQueries({queryKey: seerPrefsQueryKey});
      queryClient.invalidateQueries({
        queryKey: bulkAutofixAutomationSettingsInfiniteOptions({organization}).queryKey,
      });
    },
  });
}
