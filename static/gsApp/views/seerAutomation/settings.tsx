import {Fragment} from 'react';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';

import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {DEFAULT_CODE_REVIEW_TRIGGERS} from 'sentry/types/integrations';
import {useOrganizationMutationOptions} from 'sentry/utils/organization/useOrganizationMutationOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {
  SCMOverviewSection,
  useSCMOverviewSection,
} from 'sentry/views/settings/seer/overview/scmOverviewSection';

import {SeerSettingsPageContent} from 'getsentry/views/seerAutomation/components/seerSettingsPageContent';
import {SeerSettingsPageWrapper} from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';
import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

export function SeerAutomationSettings() {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();

  const scmOverviewData = useSCMOverviewSection();

  const orgMutationOpts = useOrganizationMutationOptions(organization);

  return (
    <SeerSettingsPageWrapper>
      <SentryDocumentTitle title={t('Seer Overview')} />
      <SettingsPageHeader
        title={t('Seer Overview')}
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
        {
          <Fragment>
            <SCMOverviewSection
              {...scmOverviewData}
              canWrite={canWrite}
              organizationSlug={organization.slug}
            />
            <FieldGroup
              title={
                <Flex gap="md">
                  <span>{t('Default automations for new projects')}</span>
                  <QuestionTooltip
                    isHoverable
                    title={tct(
                      'These settings apply as new projects are created. Any [link:existing projects] will not be affected.',
                      {
                        link: (
                          <Link to={`/settings/${organization.slug}/seer/projects/`} />
                        ),
                      }
                    )}
                    size="xs"
                    icon="info"
                  />
                </Flex>
              }
            >
              <AutoSaveForm
                name="defaultAutofixAutomationTuning"
                schema={z.object({
                  defaultAutofixAutomationTuning: z.enum(['medium', 'off']), // The API stores this as an enum, but it is displayed as a boolean toggle.
                })}
                initialValue={
                  !organization.defaultAutofixAutomationTuning ||
                  organization.defaultAutofixAutomationTuning === 'off'
                    ? 'off'
                    : 'medium'
                }
                mutationOptions={orgMutationOpts}
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
                      checked={field.state.value === 'medium'}
                      onChange={value => field.handleChange(value ? 'medium' : 'off')}
                      disabled={!canWrite}
                    />
                  </field.Layout.Row>
                )}
              </AutoSaveForm>
              <AutoSaveForm
                name="autoOpenPrs"
                schema={z.object({
                  autoOpenPrs: z.boolean(),
                })}
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
                        organization.enableSeerCoding === false
                          ? false
                          : field.state.value
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
                schema={z.object({
                  autoEnableCodeReview: z.boolean(),
                })}
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
                schema={z.object({
                  defaultCodeReviewTriggers: z.array(
                    z.enum(['on_new_commit', 'on_ready_for_review'])
                  ),
                })}
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
          </Fragment>
        }
      </SeerSettingsPageContent>
    </SeerSettingsPageWrapper>
  );
}
