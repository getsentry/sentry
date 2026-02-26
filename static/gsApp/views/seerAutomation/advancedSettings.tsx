import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';
import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

export default function SeerAdvancedSettings() {
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
          enableSeerEnhancedAlerts: organization.enableSeerEnhancedAlerts ?? true,
          enableSeerCoding: organization.enableSeerCoding ?? true,
        }}
      >
        <JsonForm
          disabled={!canWrite}
          forms={[
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
                              <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/root-cause-analysis/#code-generation" />
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
