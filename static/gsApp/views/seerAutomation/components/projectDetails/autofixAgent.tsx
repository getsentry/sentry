import {useMemo} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {
  getProjectAgentMutationOptions,
  getCodingAgentSelectQueryOptions,
  getSelectedAgentForProject,
} from 'sentry/utils/seer/preferredAgent';
import {
  PROJECT_STOPPING_POINT_OPTIONS,
  getProjectStoppingPointMutationOptions,
  getProjectStoppingPointValue,
} from 'sentry/utils/seer/stoppingPoint';
import {useOrganization} from 'sentry/utils/useOrganization';
interface Props {
  canWrite: boolean;
  preference: ProjectSeerPreferences;
  project: Project;
}

export function AutofixAgent({canWrite, preference, project}: Props) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const agentOptions = useQuery(getCodingAgentSelectQueryOptions({organization}));

  // Derive the integration objects from the options data for the agent selector
  const integrations = useMemo(
    () =>
      (agentOptions.data ?? [])
        .filter(
          (o): o is {label: string; value: CodingAgentIntegration} => o.value !== 'seer'
        )
        .map(o => o.value),
    [agentOptions.data]
  );

  const selectedAgent = getSelectedAgentForProject({integrations, preference});

  const agentMutationOptions = getProjectAgentMutationOptions({
    organization,
    project,
    queryClient,
  });

  const stoppingPointMutationOptions = getProjectStoppingPointMutationOptions({
    organization,
    queryClient,
  });

  const stoppingPointValue = getProjectStoppingPointValue(project, preference);

  const disabledReason = canWrite
    ? null
    : t('You do not have permission to update this setting.');

  return (
    <FieldGroup>
      <AutoSaveForm
        name="agent"
        schema={z.object({
          agent: z.union([z.literal('seer'), z.custom<CodingAgentIntegration>()]),
        })}
        initialValue={selectedAgent}
        mutationOptions={agentMutationOptions}
      >
        {field => (
          <field.Layout.Row
            label={t('Preferred Coding Agent')}
            hintText={
              <Text>
                {tct(
                  'Select the coding agent to use when proposing code changes. [manageLink:Manage Coding Agent Integrations]',
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
              </Text>
            }
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
                options={agentOptions.data}
                isValueEqual={(a, b) =>
                  a === b ||
                  (typeof a === 'object' && typeof b === 'object' && a.id === b.id)
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
    </FieldGroup>
  );
}
