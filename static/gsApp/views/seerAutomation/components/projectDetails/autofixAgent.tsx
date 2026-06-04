import {useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {FeatureBadge} from '@sentry/scraps/badge';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';

import Feature from 'sentry/components/acl/feature';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import type {DetailedProject} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {
  useAgentSelectOptions,
  useKnownAgents,
  getCodingAgentSelectQueryOptions,
} from 'sentry/utils/seer/preferredAgent';
import {
  getMutateSeerProjectSettingsOptions,
  getSeerProjectSettingsQueryOptions,
  seerProjectSettingsSchema,
} from 'sentry/utils/seer/seerProjectSettings';
import {
  PROJECT_STOPPING_POINT_OPTIONS,
  getProjectStoppingPointMutationOptions,
  getProjectStoppingPointValue,
} from 'sentry/utils/seer/stoppingPoint';
import type {SeerAgent} from 'sentry/utils/seer/types';
import {useOrganization} from 'sentry/utils/useOrganization';

type NightShiftValue = 'on' | 'off' | 'default';

const NIGHT_SHIFT_OPTIONS = [
  {value: 'on' as const, label: t('On')},
  {value: 'off' as const, label: t('Off')},
  {value: 'default' as const, label: t('Default (On)')},
];

function getNightShiftValue(project: DetailedProject): NightShiftValue {
  const enabled = project.seerNightshiftTweaks?.enabled;
  if (enabled === true) {
    return 'on';
  }
  if (enabled === false) {
    return 'off';
  }
  return 'default';
}

interface Props {
  canWrite: boolean;
  preference: ProjectSeerPreferences;
  project: DetailedProject;
}

export function AutofixAgent({canWrite, preference, project}: Props) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const updateProject = useUpdateProject(project);

  const agentOptions = useQuery(getCodingAgentSelectQueryOptions({organization}));
  const agentSelectOptions = useAgentSelectOptions();
  const knownAgents = useKnownAgents();

  const stoppingPointMutationOptions = getProjectStoppingPointMutationOptions({
    organization,
    queryClient,
  });

  const stoppingPointValue = getProjectStoppingPointValue(project, preference);

  const {data: projectSettings} = useQuery(
    getSeerProjectSettingsQueryOptions({organization, project})
  );

  const disabledReason = canWrite
    ? null
    : t('You do not have permission to update this setting.');

  return (
    <FieldGroup>
      <AutoSaveForm
        name="agent"
        schema={seerProjectSettingsSchema}
        initialValue={projectSettings?.agent ?? 'seer'}
        mutationOptions={getMutateSeerProjectSettingsOptions({
          organization,
          project,
          queryClient,
          knownAgents,
        })}
      >
        {field => (
          <field.Layout.Row
            label={t('Handoff to Agent')}
            hintText={tct(
              'Select your preferred agent to create a plan, and code up an issue fix. Seer Agent will always be used for the Root Cause Analysis step. [manageLink:Manage Coding Agents].',
              {
                manageLink: (
                  <Link
                    to={{
                      pathname: `/settings/${organization.slug}/integrations/`,
                      query: {category: 'coding agent'},
                    }}
                  />
                ),
              }
            )}
          >
            {agentOptions.isPending ? (
              <Placeholder height="36px" width="100%" />
            ) : agentOptions.isError ? (
              <LoadingError />
            ) : (
              <field.Select
                disabled={Boolean(disabledReason)}
                value={field.state.value}
                onChange={field.handleChange}
                options={
                  agentSelectOptions as Array<{
                    label: string;
                    value: SeerAgent;
                  }>
                }
              />
            )}
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="stoppingPoint"
        schema={z.object({
          stoppingPoint: z.enum(['off', 'root_cause', 'plan', 'create_pr']),
        })}
        initialValue={stoppingPointValue}
        mutationOptions={{
          mutationFn: (vars, fnCtx) =>
            stoppingPointMutationOptions.mutationFn!({...vars, project}, fnCtx),
          onMutate: (vars, fnCtx) =>
            stoppingPointMutationOptions.onMutate!({...vars, project}, fnCtx),
          onError: (error, vars, mutateResult, fnCtx) =>
            stoppingPointMutationOptions.onError?.(
              error,
              {...vars, project},
              mutateResult,
              fnCtx
            ),
          onSettled: (data, error, vars, mutateResult, fnCtx) =>
            stoppingPointMutationOptions.onSettled?.(
              data,
              error,
              {...vars, project},
              mutateResult,
              fnCtx
            ),
        }}
      >
        {field => (
          <field.Layout.Row
            label={t('Automation Steps')}
            hintText={tct(
              'Choose which steps Seer should run automatically on issues. Depending on how [actionable:actionable] the issue is, Seer may stop at an earlier step.',
              {
                actionable: (
                  <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#how-issue-autofix-works" />
                ),
              }
            )}
          >
            <field.Select
              disabled={Boolean(disabledReason)}
              value={field.state.value}
              onChange={field.handleChange}
              options={PROJECT_STOPPING_POINT_OPTIONS}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <Feature features="organizations:seer-night-shift-settings">
        <AutoSaveForm
          name="nightShift"
          schema={z.object({nightShift: z.enum(['on', 'off', 'default'])})}
          initialValue={getNightShiftValue(project)}
          mutationOptions={{
            mutationFn: ({nightShift}: {nightShift: NightShiftValue}) => {
              if (nightShift === 'default') {
                // 'default' means "no preference for enabled" — drop just that
                // key while preserving the manual-run debug fields. If nothing
                // else was set, send null so the option is unset entirely.
                const {enabled: _enabled, ...rest} = project.seerNightshiftTweaks ?? {};
                return updateProject.mutateAsync({
                  seerNightshiftTweaks: Object.keys(rest).length === 0 ? null : rest,
                });
              }
              return updateProject.mutateAsync({
                seerNightshiftTweaks: {
                  ...project.seerNightshiftTweaks,
                  enabled: nightShift === 'on',
                },
              });
            },
          }}
        >
          {field => (
            <field.Layout.Row
              label={
                <Flex gap="xs" align="center">
                  {t('Enable Night Shift')}
                  <FeatureBadge type="alpha" />
                </Flex>
              }
              hintText={t(
                'Run Seer on your issues overnight, so fixes are ready when you start your day.'
              )}
            >
              <field.Select
                disabled={Boolean(disabledReason)}
                value={field.state.value}
                onChange={field.handleChange}
                options={NIGHT_SHIFT_OPTIONS}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      </Feature>
    </FieldGroup>
  );
}
