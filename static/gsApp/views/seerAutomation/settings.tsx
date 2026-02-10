import {Alert} from '@sentry/scraps/alert';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';

import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {DEFAULT_CODE_REVIEW_TRIGGERS} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';

import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';
import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

export default function SeerAutomationSettings() {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();

  return (
    <SeerSettingsPageWrapper>
      <Form
        saveOnBlur
        apiMethod="PUT"
        apiEndpoint={`/organizations/${organization.slug}/`}
        allowUndo
        initialData={{
          // Project<->Repo settings:
          defaultAutofixAutomationTuning: organization.defaultAutofixAutomationTuning,
          autoOpenPrs: organization.autoOpenPrs ?? false,
          allowBackgroundAgentDelegation:
            organization.allowBackgroundAgentDelegation ?? false,

          // Second section
          autoEnableCodeReview: organization.autoEnableCodeReview ?? true,
          defaultCodeReviewTriggers:
            organization.defaultCodeReviewTriggers ?? DEFAULT_CODE_REVIEW_TRIGGERS,

          // Third section
          enableSeerEnhancedAlerts: organization.enableSeerEnhancedAlerts ?? true,
          enableSeerCoding: organization.enableSeerCoding ?? true,
        }}
      >
        <JsonForm
          disabled={!canWrite}
          forms={[
            {
              title: (
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
              ),
              fields: [
                {
                  name: 'defaultAutofixAutomationTuning',
                  label: t('Auto-Trigger Fixes by Default'),
                  help: t(
                    'For all new projects, Seer will automatically create a root cause analysis for highly actionable issues and propose a solution without a user needing to prompt it.'
                  ),
                  type: 'boolean',
                  // Convert from between enum and boolean
                  // All values other than 'off' are converted to 'medium'
                  setValue: (
                    value: Organization['defaultAutofixAutomationTuning']
                  ): boolean => Boolean(value && value !== 'off'),
                  getValue: (
                    value: boolean
                  ): Organization['defaultAutofixAutomationTuning'] =>
                    value ? 'medium' : 'off',
                },
                {
                  name: 'autoOpenPrs',
                  label: t('Allow Root Cause Analysis to create PRs by Default'),
                  help: (
                    <Stack gap="sm">
                      {t(
                        'For all new projects with connected repos, Seer will be able to make pull requests for highly actionable issues.'
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
                  ),
                  type: 'boolean',
                  disabled: !canWrite || organization.enableSeerCoding === false,
                  setValue: (value: boolean): boolean =>
                    organization.enableSeerCoding === false ? false : value,
                },
                {
                  visible: false, // TODO(ryan953): Disabled until the backend is fully ready
                  name: 'allowBackgroundAgentDelegation',
                  label: t('Allow Delegation to Background Agents'),
                  help: tct(
                    'Enable this to allow projects to use Agents other than Seer for automation tasks. [docs:Read the docs] to learn more.',
                    {
                      docs: (
                        <ExternalLink href="https://docs.sentry.io/organization/integrations/cursor/" />
                      ),
                    }
                  ),
                  type: 'boolean',
                },
              ],
            },
            {
              title: (
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
              ),
              fields: [
                {
                  name: 'autoEnableCodeReview',
                  label: t('Enable Code Review by Default'),
                  help: t(
                    'For all new repos connected, Seer will review your PRs and flag potential bugs.'
                  ),
                  type: 'boolean',
                },
                {
                  name: 'defaultCodeReviewTriggers',
                  label: t('Code Review Triggers'),
                  help: tct(
                    'Reviews can always run on demand by calling [code:@sentry review], whenever a PR is opened, or after each commit is pushed to a PR.',
                    {code: <code />}
                  ),
                  type: 'choice',
                  multiple: true,
                  choices: [
                    ['on_ready_for_review', t('On Ready for Review')],
                    ['on_new_commit', t('On New Commit')],
                  ],
                  formatMessageValue: false,
                },
              ],
            },
            {
              title: t('Advanced Settings'),
              fields: [
                {
                  name: 'enableSeerEnhancedAlerts',
                  label: t('Enable Seer Context in Alerts'),
                  help: t('Seer will provide extra context in supported alerts.'),
                  type: 'boolean',
                },
                {
                  name: 'enableSeerCoding',
                  label: t('Enable Code Generation'),
                  help: (
                    <Flex gap="sm">
                      <span>
                        {tct(
                          'Enable Seer workflows that streamline creating code changes for your review, such as the ability to create pull requests or branches. [docs:Read the docs] to learn more.',
                          {
                            docs: (
                              <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/#disabling-generative-ai-features" />
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
                  ),
                  type: 'boolean',
                  defaultValue: true, // See ENABLE_SEER_CODING_DEFAULT in sentry/src/sentry/constants.py
                },
              ],
            },
          ]}
        />
      </Form>
    </SeerSettingsPageWrapper>
  );
}
