import {Fragment} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {ExternalLink} from '@sentry/scraps/link';

import {updateOrganization} from 'sentry/actionCreators/organizations';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {SeerSettingsPageContent} from 'getsentry/views/seerAutomation/components/seerSettingsPageContent';
import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

const schema = z.object({
  enableSeerCoding: z.boolean(),
});

export default function SeerAutomationAdvancedSettings() {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();

  const orgEndpoint = `/organizations/${organization.slug}/`;
  const orgMutationOpts = mutationOptions({
    mutationFn: (data: Partial<Organization>) =>
      fetchMutation<Organization>({method: 'PUT', url: orgEndpoint, data}),
    onSuccess: updateOrganization,
  });

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Advanced Settings')} />
      <SettingsPageHeader
        title={t('Advanced Settings')}
        subtitle={tct(
          'Configure how Seer works with your codebase. Seer includes [autofix:Autofix] and [code_review:Code Review]. Autofix will triage your Issues as they are created, and can automatically send them to a coding agent for Root Cause Analysis, Solution generation, and PR creation. Code Review will review your pull requests to detect issues before they happen. [docs:Read the docs] to learn what Seer can do.',
          {
            autofix: (
              <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/" />
            ),
            code_review: (
              <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/code-review/" />
            ),
            docs: (
              <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/#seer-capabilities" />
            ),
          }
        )}
      />
      <SeerSettingsPageContent>
        <FieldGroup>
          <AutoSaveForm
            name="enableSeerCoding"
            schema={schema}
            initialValue={organization.enableSeerCoding ?? true}
            mutationOptions={orgMutationOpts}
          >
            {field => (
              <field.Layout.Row
                label={t('Enable Code Generation')}
                hintText={tct(
                  'Allow Seer to create PRs or branches in your repositories. This does not impact chat sessions where Seer Agent can always suggest code snippets or give examples. [docs:Read the docs] to learn more.',
                  {
                    docs: (
                      <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#code-generation" />
                    ),
                  }
                )}
              >
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled={
                    organization.features.includes('seer-disable-coding-setting')
                      ? t('Code generation is managed by your organization.')
                      : !canWrite
                  }
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        </FieldGroup>
      </SeerSettingsPageContent>
    </Fragment>
  );
}
