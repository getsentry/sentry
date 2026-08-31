import {mutationOptions, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Container, Stack} from '@sentry/scraps/layout';

import {getRepositoryWithSettingsQueryKey} from 'sentry/components/repositories/useRepositoryWithSettings';
import {t, tct} from 'sentry/locale';
import type {RepositoryWithSettings} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {CodeReviewTrigger} from 'sentry/types/seer';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getSeerOnboardingCheckQueryOptions} from 'sentry/utils/getSeerOnboardingCheckQueryOptions';
import {fetchMutation, getApiQueryData, setApiQueryData} from 'sentry/utils/queryClient';
import {useCanWriteSettings} from 'sentry/utils/seer/useCanWriteSettings';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';

const schema = z.object({
  enabledCodeReview: z.boolean(),
  codeReviewTriggers: z.array(z.enum(['on_new_commit', 'on_ready_for_review'])),
});

interface Props {
  organization: Organization;
  repoWithSettings: RepositoryWithSettings;
}

export function RepoDetailsForm({organization, repoWithSettings}: Props) {
  const canWrite = useCanWriteSettings();
  const queryClient = useQueryClient();

  const repoQueryKey = getRepositoryWithSettingsQueryKey(
    organization,
    repoWithSettings.id
  );

  const repoMutationOpts = mutationOptions({
    mutationFn: (
      data: Partial<{
        codeReviewTriggers: CodeReviewTrigger[];
        enabledCodeReview: boolean;
      }>
    ) => {
      return fetchMutation<RepositoryWithSettings[]>({
        method: 'PUT',
        url: getApiUrl('/organizations/$organizationIdOrSlug/repos/settings/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        data: {...data, repositoryIds: [repoWithSettings.id]},
      });
    },
    onMutate: data => {
      const previous = getApiQueryData<RepositoryWithSettings>(queryClient, repoQueryKey);
      if (previous) {
        setApiQueryData<RepositoryWithSettings>(queryClient, repoQueryKey, {
          ...previous,
          settings: {
            codeReviewTriggers: [],
            enabledCodeReview: false,
            ...previous.settings,
            ...data,
          },
        });
      }
      return {previous};
    },
    onError: (_error, _data, context) => {
      if (context?.previous) {
        setApiQueryData<RepositoryWithSettings>(
          queryClient,
          repoQueryKey,
          context.previous
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${organization.slug}/repos/`],
      });
      queryClient.invalidateQueries({
        queryKey: getSeerOnboardingCheckQueryOptions({organization}).queryKey,
      });
      queryClient.invalidateQueries({queryKey: repoQueryKey});
    },
  });

  return (
    <Stack gap="lg">
      {canWrite ? null : <OrganizationPermissionAlert />}
      <FieldGroup>
        <AutoSaveForm
          name="enabledCodeReview"
          schema={schema}
          initialValue={repoWithSettings?.settings?.enabledCodeReview ?? false}
          mutationOptions={repoMutationOpts}
        >
          {field => (
            <field.Layout.Row
              label={t('Enable Code Review')}
              hintText={t('Seer will review your PRs and flag potential bugs.')}
            >
              <Container flexGrow={1}>
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled={!canWrite}
                />
              </Container>
            </field.Layout.Row>
          )}
        </AutoSaveForm>
        <AutoSaveForm
          name="codeReviewTriggers"
          schema={schema}
          initialValue={repoWithSettings?.settings?.codeReviewTriggers ?? []}
          mutationOptions={repoMutationOpts}
        >
          {field => (
            <field.Layout.Row
              label={t('Code Review Triggers')}
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
          )}
        </AutoSaveForm>
      </FieldGroup>
    </Stack>
  );
}
