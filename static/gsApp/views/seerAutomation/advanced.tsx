import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {updateOrganization} from 'sentry/actionCreators/organizations';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {SeerSettingsPageContent} from 'getsentry/views/seerAutomation/components/seerSettingsPageContent';
import {SeerSettingsPageWrapper} from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';
import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

const schema = z.object({
  enableSeerEnhancedAlerts: z.boolean(),
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
    <SeerSettingsPageWrapper>
      <SentryDocumentTitle title={t('Seer Overview')} />
      <SettingsPageHeader
        title={t('Seer Overview')}
        subtitle={tct(
          'Configure how Seer works with your codebase. Seer includes [autofix:Autofix] and [code_review:Code Review]. Autofix will triage your Issues as they are created, and can automatically send them to a coding agent for Root Cause Analysis, Solution generation, and PR creation. Code Review will review your pull requests to detect issues before they happen. [docs:Read the docs] to learn what Seer can do.',
          {
            autofix: (
              <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#root-cause-analysis" />
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
            name="enableSeerEnhancedAlerts"
            schema={schema}
            initialValue={organization.enableSeerEnhancedAlerts ?? true}
            mutationOptions={orgMutationOpts}
          >
            {field => (
              <field.Layout.Row
                label={t('Enable Seer Context in Alerts')}
                hintText={
                  <Flex gap="sm">
                    <span>
                      {t('Seer will provide extra context in supported alerts.')}
                    </span>
                    <QuestionTooltip
                      size="xs"
                      title={t(
                        'Enable Seer to include Agent output in alerts when available. Agent output may include code snippets, explanations, and more.'
                      )}
                    />
                  </Flex>
                }
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
            name="enableSeerCoding"
            schema={schema}
            initialValue={organization.enableSeerCoding ?? true}
            mutationOptions={orgMutationOpts}
          >
            {field => (
              <field.Layout.Row
                label={t('Enable Code Generation')}
                hintText={
                  <Flex gap="sm">
                    <span>
                      {tct(
                        'Enable Seer workflows that streamline creating code changes for your review, such as the ability to create pull requests or branches. [docs:Read the docs] to learn more.',
                        {
                          docs: (
                            <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#code-generation" />
                          ),
                        }
                      )}
                    </span>
                    <QuestionTooltip
                      size="xs"
                      title={t(
                        'This does not impact chat sessions where the agent will always be able to emit code snippets and examples while responding to your input.'
                      )}
                    />
                  </Flex>
                }
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
    </SeerSettingsPageWrapper>
  );
}
