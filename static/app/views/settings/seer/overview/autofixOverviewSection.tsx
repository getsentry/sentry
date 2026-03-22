import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {AutoSaveForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {updateOrganization} from 'sentry/actionCreators/organizations';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import {IconSettings} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation, useQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SeerOverview} from 'sentry/views/settings/seer/overview/components';
import {useSeerOverviewData} from 'sentry/views/settings/seer/overview/useSeerOverviewData';
import {useAgentOptions} from 'sentry/views/settings/seer/seerAgentHooks';

interface Props {
  isLoading: boolean;
  stats: ReturnType<typeof useSeerOverviewData>['stats'];
}

export function AutofixOverviewSection({stats, isLoading}: Props) {
  const organization = useOrganization();
  const canWrite = hasEveryAccess(['org:write'], {organization});

  const schema = z.object({
    defaultCodingAgent: z.string().nullable(),
    defaultCodingAgentIntegrationId: z.number().nullable(),
    defaultAutofixAutomationTuning: z.enum(['off', 'medium']),
  });

  const {data: integrations} = useQuery({
    ...organizationIntegrationsCodingAgents(organization),
    select: data => data.json.integrations ?? [],
  });
  const options = useAgentOptions({integrations: integrations ?? []});

  const orgMutationOpts = mutationOptions({
    mutationFn: (data: Partial<Organization>) =>
      fetchMutation<Organization>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data,
      }),
    onSuccess: updateOrganization,
  });
  const autofixTuningMutationOpts = mutationOptions({
    mutationFn: (data: {defaultAutofixAutomationTuning: boolean}) =>
      fetchMutation<Organization>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data: {
          // All values other than 'off' are converted to 'medium'
          defaultAutofixAutomationTuning: data.defaultAutofixAutomationTuning
            ? 'medium'
            : 'off',
        },
      }),
    onSuccess: updateOrganization,
  });

  return (
    <SeerOverview.Section>
      <SeerOverview.SectionHeader title={t('Autofix')}>
        {isLoading ? null : (
          <Link to={`/settings/${organization.slug}/seer/repos/`}>
            <Flex align="center" gap="xs">
              {t('Configure')} <IconSettings size="xs" />
            </Flex>
          </Link>
        )}
      </SeerOverview.SectionHeader>
      <SeerOverview.Stat
        value={SeerOverview.formatStatValue(
          stats.projectsWithReposCount ?? 0,
          stats.totalProjects,
          isLoading
        )}
        isPending={isLoading}
        label={t('Projects with repos')}
      />

      <div />
      <SeerOverview.ActionButton>
        <Button
          size="xs"
          disabled={stats.projectsWithReposCount === stats.totalProjects}
          onClick={() => {
            // TODO
          }}
        >
          {t('Connect Projects to Repos')}
        </Button>
      </SeerOverview.ActionButton>

      <SeerOverview.Stat
        value={SeerOverview.formatStatValue(
          stats.projectsWithAutomationCount ?? 0,
          stats.projectsWithReposCount ?? 0,
          isLoading
        )}
        isPending={isLoading}
        label={t('Projects with Autofix Handoff enabled')}
      />

      <AutoSaveForm
        name="defaultCodingAgent"
        schema={schema}
        initialValue={organization.defaultCodingAgent ?? 'seer'}
        mutationOptions={orgMutationOpts}
      >
        {field => (
          <field.Layout.Stack
            label={t('Autofix Handoff Default')}
            hintText={t(
              'For all new projects with connected repos, Seer will handoff Autofix to a coding agent.'
            )}
          >
            <field.Select
              value={field.state.value}
              options={options}
              onChange={field.handleChange}
              disabled={!canWrite}
            />
          </field.Layout.Stack>
        )}
      </AutoSaveForm>

      {isLoading ? (
        <div />
      ) : (
        <SeerOverview.ActionButton>
          <Button
            size="xs"
            disabled={stats.projectsWithReposCount === stats.totalProjects}
            onClick={() => {
              // TODO
            }}
          >
            {tn('Apply to the project', 'Apply to all %s projects', stats.totalProjects)}
          </Button>
        </SeerOverview.ActionButton>
      )}

      <SeerOverview.Stat
        value={SeerOverview.formatStatValue(
          stats.projectsWithCreatePrCount ?? 0,
          stats.projectsWithReposCount ?? 0,
          isLoading
        )}
        isPending={isLoading}
        label={t('Projects with PR Auto Creation enabled')}
      />

      <AutoSaveForm
        name="defaultAutofixAutomationTuning"
        schema={schema}
        initialValue={organization.defaultAutofixAutomationTuning !== 'off'}
        mutationOptions={autofixTuningMutationOpts}
      >
        {field => (
          <field.Layout.Stack
            label={t('Allow Autofix to create PRs by Default')}
            hintText={t(
              'For all new projects with connected repos, Seer will be able to make pull requests for highly actionable issues.'
            )}
          >
            <field.Switch
              checked={field.state.value}
              onChange={field.handleChange}
              disabled={!canWrite}
            />
          </field.Layout.Stack>
        )}
      </AutoSaveForm>

      {isLoading ? (
        <div />
      ) : (
        <SeerOverview.ActionButton>
          <Button
            size="xs"
            disabled={stats.projectsWithReposCount === stats.totalProjects}
            onClick={() => {
              // TODO
            }}
          >
            {organization.defaultAutofixAutomationTuning === 'off'
              ? tn(
                  'Disable for the project',
                  'Disable for all %s projects',
                  stats.totalProjects
                )
              : tn(
                  'Enable for the project',
                  'Enable for all %s projects',
                  stats.totalProjects
                )}
          </Button>
        </SeerOverview.ActionButton>
      )}
    </SeerOverview.Section>
  );
}
