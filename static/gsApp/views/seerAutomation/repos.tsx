import {Flex} from '@sentry/scraps/layout';

import AnalyticsArea from 'sentry/components/analyticsArea';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {DEFAULT_CODE_REVIEW_TRIGGERS} from 'sentry/types/integrations';
import useOrganization from 'sentry/utils/useOrganization';

import SeerRepoTable from 'getsentry/views/seerAutomation/components/repoTable/seerRepoTable';
import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';
import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

export default function SeerAutomationRepos() {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();

  return (
    <AnalyticsArea name="repos">
      <SeerSettingsPageWrapper>
        <Form
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint={`/organizations/${organization.slug}/`}
          allowUndo
          initialData={{
            autoEnableCodeReview: organization.autoEnableCodeReview ?? true,
            defaultCodeReviewTriggers:
              organization.defaultCodeReviewTriggers ?? DEFAULT_CODE_REVIEW_TRIGGERS,
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
                    <span>{t('Default Code Review for New Repos')}</span>
                    <QuestionTooltip
                      isHoverable
                      title={t(
                        'These settings apply as repos are newly connected. Any existing repos will not be affected.'
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
            ]}
          />
        </Form>
        <SeerRepoTable />
      </SeerSettingsPageWrapper>
    </AnalyticsArea>
  );
}
