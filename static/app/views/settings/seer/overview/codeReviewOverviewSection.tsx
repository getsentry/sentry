import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {AutoSaveForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {updateOrganization} from 'sentry/actionCreators/organizations';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {IconSettings} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {DEFAULT_CODE_REVIEW_TRIGGERS} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SeerOverview} from 'sentry/views/settings/seer/overview/components';
import {useSeerOverviewData} from 'sentry/views/settings/seer/overview/useSeerOverviewData';

interface Props {
  isLoading: boolean;
  stats: ReturnType<typeof useSeerOverviewData>['stats'];
}

export function CodeReviewOverviewSection({stats, isLoading}: Props) {
  const organization = useOrganization();
  const canWrite = hasEveryAccess(['org:write'], {organization});

  const schema = z.object({
    autoEnableCodeReview: z.boolean(),
    defaultCodeReviewTriggers: z.array(z.enum(['on_new_commit', 'on_ready_for_review'])),
  });

  const orgMutationOpts = mutationOptions({
    mutationFn: (data: Partial<Organization>) =>
      fetchMutation<Organization>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data,
      }),
    onSuccess: updateOrganization,
  });

  return (
    <SeerOverview.Section>
      <SeerOverview.SectionHeader title={t('Code Review')}>
        {isLoading ? null : (
          <Link to={`/settings/${organization.slug}/seer/code-review/`}>
            <Flex align="center" gap="xs">
              {t('Configure')} <IconSettings size="xs" />
            </Flex>
          </Link>
        )}
      </SeerOverview.SectionHeader>
      <SeerOverview.Stat
        value={SeerOverview.formatStatValue(
          stats.reposWithCodeReviewCount,
          stats.seerRepoCount,
          isLoading
        )}
        isPending={isLoading}
        label={tn('Repo enabled', 'Repos enabled', stats.reposWithCodeReviewCount)}
      />

      <AutoSaveForm
        name="autoEnableCodeReview"
        schema={schema}
        initialValue={organization.autoEnableCodeReview ?? true}
        mutationOptions={orgMutationOpts}
      >
        {field => (
          <field.Layout.Stack
            label={t('Allow Creating PRs by Default')}
            hintText={t(
              'For all new repos connected, Seer will review your PRs and flag potential bugs.'
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
            {organization.autoEnableCodeReview
              ? tn(
                  'Disable for the repo',
                  'Disable for all %s repos',
                  stats.seerRepoCount
                )
              : tn('Enable for the repo', 'Enable for all %s repos', stats.seerRepoCount)}
          </Button>
        </SeerOverview.ActionButton>
      )}

      <div />

      <AutoSaveForm
        name="defaultCodeReviewTriggers"
        schema={schema}
        initialValue={
          organization.defaultCodeReviewTriggers ?? DEFAULT_CODE_REVIEW_TRIGGERS
        }
        mutationOptions={orgMutationOpts}
      >
        {field => (
          <field.Layout.Stack
            label={t('Code Review Triggers')}
            hintText={tct(
              'Reviews can always run on demand by calling [code:@sentry review], whenever a PR is opened, or after each commit is pushed to a PR.',
              {code: <code />}
            )}
          >
            <field.Select
              multiple
              value={field.state.value}
              onChange={field.handleChange}
              disabled={!canWrite}
              options={[
                {value: 'on_ready_for_review', label: t('On Ready for Review')},
                {value: 'on_new_commit', label: t('On New Commit')},
              ]}
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
            {tn('Set for the repo', 'Set for all %s repos', stats.seerRepoCount)}
          </Button>
        </SeerOverview.ActionButton>
      )}
    </SeerOverview.Section>
  );
}
