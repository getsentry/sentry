import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';

import {updateOrganization} from 'sentry/actionCreators/organizations';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {DEFAULT_CODE_REVIEW_TRIGGERS} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation, useQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {useAgentOptions} from 'sentry/views/settings/seer/seerAgentHooks';

import {SeerSettingsPageContent} from 'getsentry/views/seerAutomation/components/seerSettingsPageContent';
import {SeerSettingsPageWrapper} from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';
import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

const schema = z.object({
  defaultCodingAgent: z.string(),
  autoOpenPrs: z.boolean(),
  autoEnableCodeReview: z.boolean(),
  defaultCodeReviewTriggers: z.array(z.enum(['on_new_commit', 'on_ready_for_review'])),
  enableSeerEnhancedAlerts: z.boolean(),
  enableSeerCoding: z.boolean(),
});

export function SeerAutomationSettings() {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();

  const orgEndpoint = `/organizations/${organization.slug}/`;
  const orgMutationOpts = mutationOptions({
    mutationFn: (data: Partial<Organization>) =>
      fetchMutation<Organization>({method: 'PUT', url: orgEndpoint, data}),
    onSuccess: updateOrganization,
  });

  const {data: integrations} = useQuery({
    ...organizationIntegrationsCodingAgents(organization),
    select: data => data.json.integrations ?? [],
  });
  const rawAgentOptions = useAgentOptions({integrations: integrations ?? []});
  const codingAgentOptions = rawAgentOptions.map(option => ({
    value:
      option.value === 'seer' || option.value === 'none'
        ? option.value
        : option.value.id!,
    label: option.label,
  }));

  const codingAgentMutationOpts = mutationOptions({
    mutationFn: (data: {defaultCodingAgent: string}) => {
      const selected = data.defaultCodingAgent;
      return fetchMutation<Organization>({
        method: 'PUT',
        url: orgEndpoint,
        data:
          selected === 'seer'
            ? {defaultCodingAgent: selected, defaultCodingAgentIntegrationId: null}
            : selected === 'none'
              ? {defaultCodingAgent: null, defaultCodingAgentIntegrationId: null}
              : {
                  defaultCodingAgent: selected,
                  defaultCodingAgentIntegrationId: Number(selected),
                },
      });
    },
    onSuccess: updateOrganization,
  });

  return (
    <SeerSettingsPageWrapper>
      <SentryDocumentTitle title={t('Seer Overview')} />
      <SettingsPageHeader
        title={t('Seer Overview')}
        subtitle={tct(
          `Configure how Seer works with your codebase. Seer includes [autofix:Autofix] and [code_review:Code Review]. Autofix will triage your Issues as they are created, and can automatically send them to a coding agent for Root Cause Analysis, Solution generation, and PR creation. Code Review will review your pull requests to detect issues before they happen. [docs:Read the docs] to learn what Seer can do.`,
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
        <FieldGroup
          title={
            <Flex gap="md">
              <span>{t('Default automations for new projects')}</span>
              <QuestionTooltip
                isHoverable
                title={tct(
                  'These settings apply as new projects are created. Any [link:existing projects] will not be affected.',
                  {
                    link: <Link to={`/settings/${organization.slug}/seer/projects/`} />,
                  }
                )}
                size="xs"
                icon="info"
              />
            </Flex>
          }
        >
          <AutoSaveForm
            name="defaultCodingAgent"
            schema={schema}
            initialValue={
              organization.defaultCodingAgentIntegrationId
                ? String(organization.defaultCodingAgentIntegrationId)
                : organization.defaultCodingAgent
                  ? organization.defaultCodingAgent
                  : 'none'
            }
            mutationOptions={codingAgentMutationOpts}
          >
            {field => (
              <field.Layout.Row
                label={t('Default Coding Agent')}
                hintText={t(
                  'For all new projects, select which coding agent Seer will hand off to when processing issues.'
                )}
              >
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled={!canWrite}
                  options={codingAgentOptions}
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
                    {tct(
                      'For all new projects with connected repos, Seer will be able to make pull requests for [docs:highly actionable] issues.',
                      {
                        docs: (
                          <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#how-issue-autofix-works" />
                        ),
                      }
                    )}
                    {organization.enableSeerCoding === false && (
                      <Alert variant="warning">
                        {tct(
                          '[settings:"Enable Code Generation"] must be enabled for Seer to create pull requests.',
                          {
                            settings: (
                              <Link
                                to={`/settings/${organization.slug}/seer/#enableSeerCoding`}
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
        <FieldGroup
          title={
            <Flex gap="md">
              <span>{t('Default Code Review for New Repos')}</span>
              <QuestionTooltip
                isHoverable
                title={tct(
                  'These settings apply as repos are newly connected. Any [link:existing repos] will not be affected.',
                  {
                    link: <Link to={`/settings/${organization.slug}/seer/repos/`} />,
                  }
                )}
                size="xs"
                icon="info"
              />
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
        <FieldGroup title={t('Advanced Settings')}>
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
