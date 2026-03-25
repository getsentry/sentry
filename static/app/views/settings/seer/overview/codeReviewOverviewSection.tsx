import {useCallback} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import uniqBy from 'lodash/uniqBy';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {organizationRepositoriesInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useOrganizationRepositories';
import {isSupportedAutofixProvider} from 'sentry/components/events/autofix/utils';
import {useBulkUpdateRepositorySettings} from 'sentry/components/repositories/useBulkUpdateRepositorySettings';
import {getRepositoryWithSettingsQueryKey} from 'sentry/components/repositories/useRepositoryWithSettings';
import {IconRefresh, IconSettings} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {DEFAULT_CODE_REVIEW_TRIGGERS} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {useInfiniteQuery, useQueryClient} from 'sentry/utils/queryClient';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useCodeReviewOverviewSection() {
  const organization = useOrganization();

  const queryOptions = organizationRepositoriesInfiniteOptions({
    organization,
    query: {per_page: 100},
  });
  const repositoriesResult = useInfiniteQuery({
    ...queryOptions,
    select: ({pages}) => {
      const repos = uniqBy(
        pages.flatMap(page => page.json),
        'externalId'
      ).filter(repository => repository.externalId);
      const seerRepos = repos.filter(r => isSupportedAutofixProvider(r.provider));
      const reposWithCodeReview = seerRepos.filter(r => r.settings?.enabledCodeReview);
      return {
        queryKey: queryOptions.queryKey,
        seerRepos,
        reposWithCodeReview,
      };
    },
  });
  useFetchAllPages({result: repositoriesResult});

  return repositoriesResult;
}

type Props = ReturnType<typeof useCodeReviewOverviewSection> & {
  canWrite: boolean;
  organization: Organization;
};

export function CodeReviewOverviewSection({
  isPending,
  organization,
  data,
  refetch,
}: Props) {
  const queryClient = useQueryClient();

  const canWrite = hasEveryAccess(['org:write'], {organization});

  const {queryKey, seerRepos = [], reposWithCodeReview = []} = data ?? {};

  const seerReposCount = seerRepos.length;
  const reposWithCodeReviewCount = reposWithCodeReview.length;

  const schema = z.object({
    autoEnableCodeReview: z.boolean(),
    defaultCodeReviewTriggers: z.array(z.enum(['on_new_commit', 'on_ready_for_review'])),
  });

  const orgMutationOpts = mutationOptions({
    mutationFn: (updateData: Partial<Organization>) =>
      fetchMutation<Organization>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data: updateData,
      }),
    onSuccess: updateOrganization,
  });

  const {mutate: mutateRepositorySettings} = useBulkUpdateRepositorySettings({
    onSettled: mutations => {
      // Invalidate the repositories query to get the updated settings
      queryClient.invalidateQueries({queryKey});
      (mutations ?? []).forEach(mutation => {
        // Invalidate related queries
        queryClient.invalidateQueries({
          queryKey: getRepositoryWithSettingsQueryKey(organization, mutation.id),
        });
      });
    },
  });

  const handleToggleCodeReview = useCallback(
    (enabledCodeReview: boolean) => {
      const repositoryIds = (
        enabledCodeReview
          ? seerRepos.filter(repo => !repo.settings?.enabledCodeReview)
          : reposWithCodeReview
      ).map(repo => repo.id);
      mutateRepositorySettings(
        {enabledCodeReview, repositoryIds},
        {
          onError: (_, variables) => {
            addErrorMessage(
              tn(
                'Failed to update code review for %s repository',
                'Failed to update code review for %s repositories',
                variables.repositoryIds.length
              )
            );
          },
          onSuccess: (_, variables) => {
            addSuccessMessage(
              tn(
                'Code review updated for %s repository',
                'Code review updated for %s repositories',
                variables.repositoryIds.length
              )
            );
          },
        }
      );
    },
    [mutateRepositorySettings, reposWithCodeReview, seerRepos]
  );

  const handleChangeTriggers = useCallback(
    (newTriggers: string[]) => {
      mutateRepositorySettings(
        {
          codeReviewTriggers: newTriggers,
          repositoryIds: seerRepos.map(repo => repo.id),
        },
        {
          onError: (_, variables) => {
            addErrorMessage(
              tn(
                'Failed to update triggers for %s repository',
                'Failed to update triggers for %s repositories',
                variables.repositoryIds.length
              )
            );
          },
          onSuccess: (_, variables) => {
            addSuccessMessage(
              tn(
                'Triggers updated for %s repository',
                'Triggers updated for %s repositories',
                variables.repositoryIds.length
              )
            );
          },
        }
      );
    },
    [mutateRepositorySettings, seerRepos]
  );

  return (
    <FieldGroup
      title={
        <Flex justify="between" gap="md" flexGrow={1}>
          <Flex align="center" gap="md">
            <span>{t('Code Review')}</span>
            <Button
              size="zero"
              priority="link"
              icon={<IconRefresh size="xs" />}
              aria-label={t('Reload repositories')}
              onClick={() => refetch()}
            />
          </Flex>
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
          <Stack gap="md">
            <field.Layout.Row
              label={t('Enable Code Review by Default')}
              hintText={t(
                'For all new projects, select which coding agent Seer will hand off to when processing issues.'
              )}
            >
              <Container flexGrow={1}>
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled={!canWrite}
                />
              </Container>
            </field.Layout.Row>

            <Flex align="center" alignSelf="end" gap="md" width="50%" paddingLeft="xl">
              <Button
                size="xs"
                busy={isPending}
                disabled={
                  !canWrite || field.state.value
                    ? reposWithCodeReviewCount === seerReposCount
                    : seerReposCount - reposWithCodeReviewCount === seerReposCount
                }
                onClick={() => {
                  handleToggleCodeReview(field.state.value);
                }}
              >
                {field.state.value
                  ? tn(
                      'Enable for existing repo',
                      'Enable for all existing repos',
                      seerReposCount - reposWithCodeReviewCount
                    )
                  : tn(
                      'Disable for the existing repo',
                      'Disable for all existing repos',
                      reposWithCodeReviewCount
                    )}
              </Button>
              <Text variant="secondary" size="sm">
                {field.state.value
                  ? t(
                      '%s of %s existing repos have code review enabled',
                      reposWithCodeReviewCount,
                      seerReposCount
                    )
                  : t(
                      '%s of %s existing repos have code review disabled',
                      seerReposCount - reposWithCodeReviewCount,
                      seerReposCount
                    )}
              </Text>
            </Flex>
          </Stack>
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
          <Stack gap="md">
            <field.Layout.Row
              label={t('Default Code Review Triggers')}
              hintText={tct(
                'Reviews can always run on demand by calling [code:@sentry review], whenever a PR is opened, or after each commit is pushed to a PR.',
                {code: <code />}
              )}
            >
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
            </field.Layout.Row>
            <Flex align="center" alignSelf="end" gap="md" width="50%" paddingLeft="xl">
              <Button
                size="xs"
                busy={isPending}
                disabled={!canWrite}
                onClick={() => {
                  handleChangeTriggers(field.state.value);
                }}
              >
                {tn(
                  'Set for the existing repo',
                  'Set for all existing repos',
                  seerReposCount
                )}
              </Button>
            </Flex>
          </Stack>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}
