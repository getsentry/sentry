import {useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {FeatureBadge} from '@sentry/scraps/badge';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import Feature from 'sentry/components/acl/feature';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import type {DetailedProject} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {
  seerAgentIntegrationsSelectQueryOptions,
  knownAgentIntegrationsQueryOptions,
  coalesePreferredAgent,
} from 'sentry/utils/seer/preferredAgent';
import {
  getMutateSeerProjectSettingsOptions,
  getSeerProjectSettingsQueryOptions,
  seerProjectSettingsSchema,
} from 'sentry/utils/seer/seerProjectSettings';
import {
  coaleseStoppingPoint,
  useStoppingPointSelectOptions,
} from 'sentry/utils/seer/stoppingPoint';
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

  project: DetailedProject;
}

export function AutofixAgent({canWrite, project}: Props) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {data: knownAgents} = useQuery(
    knownAgentIntegrationsQueryOptions({organization})
  );

  const {data: agentSelectOptions = []} = useQuery(
    seerAgentIntegrationsSelectQueryOptions({organization})
  );
  const stoppingPointOptions = useStoppingPointSelectOptions();

  const updateProject = useUpdateProject(project);

  const {data, isPending, isError, error} = useQuery(
    getSeerProjectSettingsQueryOptions({
      organization,
      project: {slug: project.slug},
    })
  );

  if (isPending) {
    return (
      <Flex justify="center" padding="xl">
        <LoadingIndicator />
      </Flex>
    );
  }

  if (isError) {
    return (
      <Flex justify="center" padding="xl">
        <Text variant="muted">{t('Error: %s', error.message)}</Text>
      </Flex>
    );
  }

  if (!data) {
    return (
      <Flex justify="center" padding="xl">
        <Text variant="muted">{t('No data found')}</Text>
      </Flex>
    );
  }

  const disabledReason = canWrite
    ? null
    : t('You do not have permission to update this setting.');

  return (
    <FieldGroup>
      <AutoSaveForm
        name="agentOption"
        schema={seerProjectSettingsSchema}
        initialValue={coalesePreferredAgent(data.agent, data.integrationId)}
        mutationOptions={getMutateSeerProjectSettingsOptions({
          organization,
          project: {slug: project.slug},
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
            <field.Select
              disabled={!canWrite}
              multiple={false}
              onChange={field.handleChange}
              options={agentSelectOptions}
              value={field.state.value}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="stoppingPoint"
        schema={seerProjectSettingsSchema}
        initialValue={coaleseStoppingPoint(data.stoppingPoint, data.automationTuning)}
        mutationOptions={getMutateSeerProjectSettingsOptions({
          organization,
          project: {slug: project.slug},
          queryClient,
        })}
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
              disabled={!canWrite}
              value={field.state.value}
              onChange={field.handleChange}
              options={stoppingPointOptions}
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
