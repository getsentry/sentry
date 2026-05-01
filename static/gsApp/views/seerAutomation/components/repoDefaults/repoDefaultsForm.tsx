import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';

import {updateOrganization} from 'sentry/actionCreators/organizations';
import {t, tct} from 'sentry/locale';
import {DEFAULT_CODE_REVIEW_TRIGGERS} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation} from 'sentry/utils/queryClient';

import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

const schema = z.object({
  autoEnableCodeReview: z.boolean(),
  defaultCodeReviewTriggers: z.array(z.enum(['on_new_commit', 'on_ready_for_review'])),
});

interface Props {
  organization: Organization;
}

export function RepoDefaultsForm({organization}: Props) {
  const canWrite = useCanWriteSettings();

  const orgEndpoint = `/organizations/${organization.slug}/`;
  const orgMutationOpts = mutationOptions({
    mutationFn: (data: Partial<Organization>) =>
      fetchMutation<Organization>({method: 'PUT', url: orgEndpoint, data}),
    onSuccess: updateOrganization,
  });

  return (
    <Stack gap="lg">
      {canWrite ? null : (
        <Alert variant="warning">
          {t(
            'These settings can only be edited by users with the organization owner or manager role.'
          )}
        </Alert>
      )}
      <FieldGroup>
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
                'For all new repos connected, Seer will review your PRs and flag potential bugs.'
              )}
            >
              <field.Switch
                checked={field.state.value}
                onChange={field.handleChange}
                disabled={!canWrite}
              />
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
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      </FieldGroup>
    </Stack>
  );
}
