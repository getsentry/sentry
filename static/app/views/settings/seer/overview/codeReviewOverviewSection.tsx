import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {updateOrganization} from 'sentry/actionCreators/organizations';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {IconSettings} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {DEFAULT_CODE_REVIEW_TRIGGERS} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
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
    <FieldGroup
      title={
        <Flex justify="between" gap="md" flexGrow={1}>
          <span>{t('Code Review')}</span>
          <Text uppercase={false}>
            <Link to={`/settings/${organization.slug}/seer/repos/`}>
              <Flex align="center" gap="xs">
                {t('Configure')} <IconSettings size="xs" />
              </Flex>
            </Link>
          </Text>
        </Flex>
      }
    >
      <AutoSaveForm
        name="autoEnableCodeReview"
        schema={schema}
        initialValue={organization.autoEnableCodeReview ?? true}
        mutationOptions={orgMutationOpts}
      >
        {field => (
          <field.Layout.Row
            label={t('Enable Code Review by Default')}
            hintText={t(
              'For all new projects, select which coding agent Seer will hand off to when processing issues.'
            )}
          >
            <Grid columns="1fr 1fr" gap="lg">
              <Container flexGrow={1}>
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled={!canWrite}
                />
              </Container>

              <Stack align="end" justify="center" gap="md">
                <Text variant="secondary" size="sm">
                  {field.state.value
                    ? t(
                        '%s of %s existing repos have code review disabled',
                        stats.seerRepoCount - stats.reposWithCodeReviewCount,
                        stats.seerRepoCount
                      )
                    : t(
                        '%s of %s existing repos have code review enabled',
                        stats.reposWithCodeReviewCount,
                        stats.seerRepoCount
                      )}
                </Text>
                <Button
                  size="xs"
                  busy={isLoading}
                  disabled={stats.projectsWithReposCount === stats.totalProjects}
                  onClick={() => {
                    // TODO
                  }}
                >
                  {field.state.value
                    ? tn(
                        'Enable for existing repo',
                        'Enable for %s existing repos',
                        stats.seerRepoCount - stats.reposWithCodeReviewCount
                      )
                    : tn(
                        'Disable for the existing repo',
                        'Disable for %s existing repos',
                        stats.seerRepoCount - stats.reposWithCodeReviewCount
                      )}
                </Button>
              </Stack>
            </Grid>
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="defaultCodeReviewTriggers"
        schema={schema}
        initialValue={
          organization.defaultCodeReviewTriggers ?? DEFAULT_CODE_REVIEW_TRIGGERS
        }
        mutationOptions={orgMutationOpts}
      >
        {field => (
          <field.Layout.Row
            label={t('Code Review Triggers')}
            hintText={tct(
              'Reviews can always run on demand by calling [code:@sentry review], whenever a PR is opened, or after each commit is pushed to a PR.',
              {code: <code />}
            )}
          >
            <Grid columns="1fr 1fr" gap="lg">
              <Container flexGrow={1}>
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
              </Container>

              <Stack align="end" justify="center" gap="md">
                <Button
                  size="xs"
                  busy={isLoading}
                  // disabled={stats.projectsWithReposCount === stats.seerRepoCount}
                  onClick={() => {
                    // TODO
                  }}
                >
                  {tn(
                    'Set for the existing repo',
                    'Set for %s existing repos',
                    stats.seerRepoCount
                  )}
                </Button>
              </Stack>
            </Grid>
          </field.Layout.Row>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}
