import {Flex} from '@sentry/scraps/layout/flex';
import {ExternalLink, Link} from '@sentry/scraps/link/link';

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
                  label: t('Enable Autofix PR Creation by Default'),
                  help: t(
                    'For all new projects with connected repositories, Seer will be able to make pull requests for highly actionable issues.'
                  ),
                  type: 'boolean',
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
              // title: t('Default Code Review for New Repos'),
              title: (
                <Flex gap="md">
                  <span>{t('Default Code Review for New Repos')}</span>
                  <QuestionTooltip
                    isHoverable
                    title={tct(
                      'These settings apply as repositories are newly connected. Any [link:existing repositories] will not be affected.',
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
                  help: t(
                    'Reviews can run on demand, whenever a PR is opened, or after each commit is pushed to a PR.'
                  ),
                  type: 'choice',
                  multiple: true,
                  choices: [
                    ['on_command_phrase', t('On Command Phrase')],
                    ['on_ready_for_review', t('On Ready for Review')],
                    ['on_new_commit', t('On New Commit')],
                  ],
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
              ],
            },
          ]}
        />
      </Form>
    </SeerSettingsPageWrapper>
  );
}
