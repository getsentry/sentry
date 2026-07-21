import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {SizeRulesPanel} from './sizeRulesPanel';
import {DEFAULT_ARTIFACT_TYPE} from './types';

export function PrCommentRules() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  return (
    <SizeRulesPanel
      config={{
        rules: {
          enabledField: 'preprodSizePrCommentsEnabled',
          enabledOptionKey: 'sentry:preprod_size_pr_comments_enabled',
          defaultEnabled: false,
          rulesField: 'preprodSizePrCommentsRules',
          rulesOptionKey: 'sentry:preprod_size_pr_comments_rules',
          toasts: {
            enabled: t('PR comments enabled.'),
            disabled: t('PR comments disabled.'),
            created: t('PR comment rule created.'),
            saved: t('PR comment rule saved.'),
            deleted: t('PR comment rule deleted.'),
          },
        },
        copy: {
          panelTitle: t('Size Analysis - PR Comments'),
          enabledLabel: t('PR Comments Enabled'),
          enabledDescription: t(
            "Sentry will post PR comments based on your build's app size."
          ),
          toggleAriaLabel: t('Toggle PR comments'),
          emptyRulesText: t('No PR comment rules configured. Create one to get started.'),
          disabledHintText: t('Enable PR comments above to configure rules.'),
          addRuleButtonLabel: t('Create PR Comment Rule'),
          connectRepoText: t(
            'Connect at least one repository to get Size Analysis PR comments'
          ),
          form: {
            headerLabel: t('Comment on PR When'),
            deleteConfirmHeader: t(
              'Are you sure you want to delete this PR comment rule?'
            ),
            deleteConfirmMessage: (ruleDescription, valueWithUnit) => (
              <span>
                Will no longer comment on PRs when <strong>{ruleDescription}</strong>{' '}
                surpasses <strong>{valueWithUnit}</strong>
              </span>
            ),
            searchSource: 'preprod_pr_comment_filters',
          },
        },
        analytics: {
          onCreate: () =>
            trackAnalytics('preprod.settings.pr_comment_rule_created', {
              organization,
              project_slug: project.slug,
            }),
          onUpdate: rule =>
            trackAnalytics('preprod.settings.pr_comment_rule_updated', {
              organization,
              project_slug: project.slug,
              metric: rule.metric,
              measurement: rule.measurement,
              artifact_type: rule.artifactType ?? DEFAULT_ARTIFACT_TYPE,
              value: rule.value,
            }),
          onDelete: () =>
            trackAnalytics('preprod.settings.pr_comment_rule_deleted', {
              organization,
              project_slug: project.slug,
            }),
        },
      }}
    />
  );
}
