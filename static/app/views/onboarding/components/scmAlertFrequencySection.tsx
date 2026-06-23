import {Tag} from '@sentry/scraps/badge';
import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {TagVariant} from 'sentry/utils/theme';
import {
  type AlertRuleOptions,
  RuleAction,
} from 'sentry/views/projectInstall/issueAlertOptions';

import {ScmAlertFrequency} from './scmAlertFrequency';
import type {ScmAnalyticsFlow} from './scmAnalyticsFlow';
import {ScmCollapsibleSection} from './scmCollapsibleSection';

interface ScmAlertFrequencySectionProps {
  alertRuleConfig: AlertRuleOptions;
  analyticsFlow: ScmAnalyticsFlow;
  onAlertChange: <K extends keyof AlertRuleOptions>(
    key: K,
    value: AlertRuleOptions[K]
  ) => void;
}

/**
 * Alert-frequency configuration, rendered as a sibling of `ScmProjectDetailsCore`.
 * In project creation it folds away behind a collapsible toggle (one of several
 * stacked config cards); in onboarding it stays always expanded under its own
 * heading. Presentational only: the alert state and field analytics live in
 * `useScmProjectDetails`, which the host wires to `alertRuleConfig`/`onAlertChange`.
 */
export function ScmAlertFrequencySection({
  alertRuleConfig,
  analyticsFlow,
  onAlertChange,
}: ScmAlertFrequencySectionProps) {
  const collapsible = analyticsFlow === 'project-creation';

  if (collapsible) {
    // Summarize the current selection in the collapsed header.
    const alertSettingLabel: Record<RuleAction, [string, TagVariant]> = {
      [RuleAction.DEFAULT_ALERT]: [t('High priority issues'), 'info'],
      [RuleAction.CUSTOMIZED_ALERTS]: [t('Custom'), 'info'],
      [RuleAction.CREATE_ALERT_LATER]: [t('Off'), 'muted'],
    };

    const [label, variant] = alertSettingLabel[alertRuleConfig.alertSetting];

    return (
      <ScmCollapsibleSection
        title={t('Alert frequency')}
        defaultExpanded={false}
        trailing={<Tag variant={variant}>{label}</Tag>}
      >
        <Stack gap="md" width="100%">
          <ScmAlertFrequency {...alertRuleConfig} onFieldChange={onAlertChange} />
        </Stack>
      </ScmCollapsibleSection>
    );
  }

  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Container>
          <Text bold size="md" density="comfortable">
            {t('Alert frequency')}
          </Text>
        </Container>
        <Container>
          <Text variant="muted" density="comfortable">
            {t('Get notified when things go wrong')}
          </Text>
        </Container>
      </Stack>
      <ScmAlertFrequency {...alertRuleConfig} onFieldChange={onAlertChange} />
    </Stack>
  );
}
