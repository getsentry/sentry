import {Alert} from '@sentry/scraps/alert';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import AnalyticsArea from 'sentry/components/analyticsArea';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';

import SeerProjectTable from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTable';
import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';
import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

export default function SeerAutomationProjects() {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();

  return (
    <AnalyticsArea name="projects">
      <SeerSettingsPageWrapper>
        <Form
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint={`/organizations/${organization.slug}/`}
          allowUndo
          initialData={{
            defaultAutofixAutomationTuning: organization.defaultAutofixAutomationTuning,
            autoOpenPrs: organization.autoOpenPrs ?? false,
          }}
        >
          <JsonForm
            collapsible
            initiallyCollapsed
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
                ],
              },
            ]}
          />
        </Form>
        <SeerProjectTable />
      </SeerSettingsPageWrapper>
    </AnalyticsArea>
  );
}
