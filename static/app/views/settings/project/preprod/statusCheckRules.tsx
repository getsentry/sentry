import {ExternalLink} from '@sentry/scraps/link';

import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {SizeRulesPanel} from './sizeRulesPanel';
import {DEFAULT_ARTIFACT_TYPE} from './types';

export function StatusCheckRules() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  return (
    <SizeRulesPanel
      config={{
        rules: {
          enabledField: 'preprodSizeStatusChecksEnabled',
          enabledOptionKey: 'sentry:preprod_size_status_checks_enabled',
          defaultEnabled: true,
          rulesField: 'preprodSizeStatusChecksRules',
          rulesOptionKey: 'sentry:preprod_size_status_checks_rules',
          toasts: {
            enabled: t('Status checks enabled.'),
            disabled: t('Status checks disabled.'),
            created: t('Status check rule created.'),
            saved: t('Status check rule saved.'),
            deleted: t('Status check rule deleted.'),
          },
        },
        copy: {
          panelTitle: t('Size Analysis - Status Checks'),
          docsHint: {
            text: tct(
              "Fails your PR's status check when a build exceeds one of these rules. Rules are also available via the [link:API].",
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/api/mobile-builds/retrieve-size-analysis-status-check-rules-for-a-project/" />
                ),
              }
            ),
            docsUrl: 'https://docs.sentry.io/product/size-analysis/#status-checks',
          },
          enabledLabel: t('Enable Status Checks'),
          enabledDescription: t(
            "Sentry will post status checks based on your build's app size."
          ),
          toggleAriaLabel: t('Toggle status checks'),
          disabledTooltip: tct(
            'Status checks will not post. Rules are still accessible via the [link:API]',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/api/mobile-builds/retrieve-size-analysis-status-check-rules-for-a-project/" />
              ),
            }
          ),
          emptyRulesText: t(
            'No status check rules configured. Create one to get started.'
          ),
          addRuleButtonLabel: t('Create Status Check Rule'),
          connectRepoText: t(
            'Connect at least one repository to get Size Analysis status checks'
          ),
          form: {
            headerLabel: t('Fail Status Check When'),
            deleteConfirmHeader: t(
              'Are you sure you want to delete this status check rule?'
            ),
            deleteConfirmMessage: (ruleDescription, valueWithUnit) => (
              <span>
                Will no longer fail status checks when <strong>{ruleDescription}</strong>{' '}
                surpasses <strong>{valueWithUnit}</strong>
              </span>
            ),
            searchSource: 'preprod_status_check_filters',
          },
        },
        analytics: {
          onCreate: () =>
            trackAnalytics('preprod.settings.status_check_rule_created', {
              organization,
              project_slug: project.slug,
            }),
          onUpdate: rule =>
            trackAnalytics('preprod.settings.status_check_rule_updated', {
              organization,
              project_slug: project.slug,
              metric: rule.metric,
              measurement: rule.measurement,
              artifact_type: rule.artifactType ?? DEFAULT_ARTIFACT_TYPE,
              value: rule.value,
            }),
          onDelete: () =>
            trackAnalytics('preprod.settings.status_check_rule_deleted', {
              organization,
              project_slug: project.slug,
            }),
        },
      }}
    />
  );
}
