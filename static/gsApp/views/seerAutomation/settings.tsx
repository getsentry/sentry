import {ExternalLink} from '@sentry/scraps/link/link';

import {hasEveryAccess} from 'sentry/components/acl/access';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';

import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';

export default function SeerAutomationSettings() {
  const organization = useOrganization();
  const canWrite = hasEveryAccess(['org:write'], {organization});

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
          enableSeerCoding: organization.enableSeerCoding ?? true,
          // run on opened PRs -> boolean
          // run when mentioned -> boolean

          // Third section
          enableSeerEnhancedAlerts: organization.enableSeerEnhancedAlerts ?? true,
        }}
      >
        <JsonForm
          disabled={!canWrite}
          forms={[
            {
              title: t('Default automations for new projects'),
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
                    'For all new projects with connected repos, Seer will be able to make pull requests for highly actionable issues.'
                  ),
                  type: 'boolean',
                },
                {
                  // TODO: Depends on https://github.com/getsentry/sentry/pull/104362
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
              title: t('Default Code Review for New Repos'),
              fields: [
                {
                  name: 'defaultRepoCodeReview',
                  label: t('Enable Code Review by Default'),
                  help: t(
                    'For all new repos connected, Seer will review your PRs and flag potential bugs'
                  ),
                  type: 'boolean',
                },
                {
                  name: '',
                  type: 'collapsible',
                  label: t('additional settings'),
                  fields: [
                    {
                      name: 'defaultRepoPRRunOnOpenedPullRequests',
                      label: t('Auto Run on Opened Pull Requests'),
                      help: t(
                        'Run when a new pull request is published, ignoring subsequent pushes.'
                      ),
                      type: 'boolean',
                    },
                    {
                      name: 'defaultRepoPRRunWhenMentioned',
                      label: t('Run When Mentioned'),
                      help: tct(
                        'Run when [code:@sentry review] is commented on a pull request.',
                        {
                          code: <code />,
                        }
                      ),
                      type: 'boolean',
                    },
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
