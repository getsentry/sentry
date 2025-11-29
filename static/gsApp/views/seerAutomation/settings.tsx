import {Container} from '@sentry/scraps/layout/container';
import {ExternalLink} from '@sentry/scraps/link/link';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/core/alert';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';

export default function SeerAutomationSettings() {
  const organization = useOrganization();
  const canWrite = hasEveryAccess(['org:write'], {organization});

  return (
    <SeerSettingsPageWrapper>
      {canWrite ? null : (
        <Alert data-test-id="org-permission-alert" type="warning">
          {t(
            'These settings can only be edited by users with the organization owner or manager role.'
          )}
        </Alert>
      )}

      <Form
        saveOnBlur
        apiMethod="PUT"
        apiEndpoint={`/organizations/${organization.slug}/`}
        allowUndo
        initialData={{
          // First section
          defaultSeerScannerAutomation:
            organization.defaultSeerScannerAutomation ?? false,
          defaultAutofixAutomationTuning:
            organization.defaultAutofixAutomationTuning ?? 'off',

          // auto-fix enabled -> boolean
          // @ts-expect-error: New Field, depends on https://github.com/getsentry/sentry/pull/104049
          autoOpenPrs: organization.autoOpenPrs ?? false,
          // sensitivity -> high/medium/low

          // Second section
          enableSeerCoding: organization.enableSeerCoding ?? true,
          // sensitivity -> high/medium/low
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
              title: t('Default Automations for new projects'),
              fields: [
                {
                  name: 'defaultAutofixAutomationTuning',
                  label: t('Auto-Triggered Fixes by Default'),
                  help: t(
                    'For all new projects, Seer will automatically analyze highly actionable issues, and create a root cause analysis and proposed solution without a user needing to prompt it.'
                  ),
                  type: 'boolean',
                  // This will actually set the value to be "off" or "Moderately Actionable and Above (`medium`)"
                },
                {
                  // TODO: Depends on https://github.com/getsentry/sentry/pull/104049
                  name: 'autoOpenPrs',
                  label: t('Allow Fix PR Creation by Default'),
                  help: t(
                    'For all new projects with connected repos, Seer will be able to make a pull requests for highly actionable issues.'
                  ),
                  type: 'boolean',
                },
                {
                  // TODO: Depends on future PR
                  name: 'allowProjectAgentDelegation',
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
                  label: '',
                  type: 'custom',
                  Component: () => {
                    return (
                      <Container padding="lg">
                        <JsonForm
                          disabled={!canWrite}
                          collapsible
                          initiallyCollapsed
                          title="additional settings"
                          fields={[
                            {
                              name: 'defaultProjectPRSensitivity',
                              label: t('Error Prediction Sensitivity'),
                              help: t('Set the sensitivity level for error prediction.'),
                              type: 'select',
                              options: [
                                {
                                  label: t('Low'),
                                  value: 'low',
                                },
                                {
                                  label: t('Medium'),
                                  value: 'medium',
                                },
                                {
                                  label: t('High'),
                                  value: 'high',
                                },
                              ],
                            },
                            {
                              name: 'defaultRepoPRRunOnOpenedPullRequests',
                              label: t('Auto Run on Opened Pull Requests'),
                              help: t(
                                'Run when a new pull request is published, ignoring new pushes.'
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
                          ]}
                        />
                      </Container>
                    );
                  },
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
