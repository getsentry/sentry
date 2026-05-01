import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';

import {updateOrganization} from 'sentry/actionCreators/organizations';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation} from 'sentry/utils/queryClient';

import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

const schema = z.object({
  defaultAutofixAutomationTuning: z.boolean(),
  autoOpenPrs: z.boolean(),
});

interface Props {
  organization: Organization;
}

export function ProjectDefaultsForm({organization}: Props) {
  const canWrite = useCanWriteSettings();

  const orgEndpoint = `/organizations/${organization.slug}/`;
  const orgMutationOpts = mutationOptions({
    mutationFn: (data: Partial<Organization>) =>
      fetchMutation<Organization>({method: 'PUT', url: orgEndpoint, data}),
    onSuccess: updateOrganization,
  });
  const autofixTuningMutationOpts = mutationOptions({
    mutationFn: (data: {defaultAutofixAutomationTuning: boolean}) =>
      fetchMutation<Organization>({
        method: 'PUT',
        url: orgEndpoint,
        data: {
          defaultAutofixAutomationTuning: data.defaultAutofixAutomationTuning
            ? 'medium'
            : 'off',
        },
      }),
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
          name="defaultAutofixAutomationTuning"
          schema={schema}
          initialValue={Boolean(
            organization.defaultAutofixAutomationTuning &&
            organization.defaultAutofixAutomationTuning !== 'off'
          )}
          mutationOptions={autofixTuningMutationOpts}
        >
          {field => (
            <field.Layout.Row
              label={t('Auto-Trigger Fixes by Default')}
              hintText={tct(
                'For all new projects, Seer will automatically create a root cause analysis for [docs:highly actionable] issues and propose a solution without a user needing to prompt it.',
                {
                  docs: (
                    <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#how-issue-autofix-works" />
                  ),
                }
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
          name="autoOpenPrs"
          schema={schema}
          initialValue={organization.autoOpenPrs ?? false}
          mutationOptions={orgMutationOpts}
        >
          {field => (
            <field.Layout.Row
              label={t('Allow Autofix to create PRs by Default')}
              hintText={
                <Stack gap="sm">
                  <span>
                    {tct(
                      'For all new projects with connected repos, Seer will be able to make pull requests for [docs:highly actionable] issues.',
                      {
                        docs: (
                          <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#how-issue-autofix-works" />
                        ),
                      }
                    )}
                  </span>
                  {organization.enableSeerCoding === false && (
                    <Alert variant="warning">
                      {tct(
                        '[settings:"Enable Code Generation"] must be enabled for Seer to create pull requests.',
                        {
                          settings: (
                            <Link
                              to={`/settings/${organization.slug}/seer/advanced/#enableSeerCoding`}
                            />
                          ),
                        }
                      )}
                    </Alert>
                  )}
                </Stack>
              }
            >
              <field.Switch
                checked={
                  organization.enableSeerCoding === false ? false : field.state.value
                }
                onChange={field.handleChange}
                disabled={
                  organization.enableSeerCoding === false
                    ? t('Enable Code Generation to allow Autofix to create PRs.')
                    : !canWrite
                }
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      </FieldGroup>
    </Stack>
  );
}
