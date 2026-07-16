import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {TagVariant} from 'sentry/utils/theme';
import {type IssueAlertNotificationProps} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import {
  type AlertRuleOptions,
  RuleAction,
} from 'sentry/views/projectInstall/issueAlertOptions';

import {ScmAlertFrequency} from './scmAlertFrequency';
import type {ScmAnalyticsFlow} from './scmAnalyticsFlow';
import {ScmCollapsibleReveal} from './scmCollapsibleReveal';
import {ScmCollapsibleSection} from './scmCollapsibleSection';
import {ScmIssueAlertNotificationOptions} from './scmIssueAlertNotificationOptions';

interface ScmAlertFrequencySectionProps {
  alertRuleConfig: AlertRuleOptions;
  analyticsFlow: ScmAnalyticsFlow;
  notificationProps: IssueAlertNotificationProps;
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
  notificationProps,
  onAlertChange,
}: ScmAlertFrequencySectionProps) {
  const collapsible = analyticsFlow === 'project-creation';

  // Notification options are irrelevant when the user opts out of alerts, so
  // hide them for "create alerts later" (mirrors issueAlertOptions). Route the
  // show/hide through the shared height tween: on the custom -> "set up later"
  // switch the custom-threshold body collapses via its own ScmCollapsibleReveal,
  // so snapping this block to null at the same time bounces the whole form.
  // Animating its height keeps the shift smooth and anchored from the bottom.
  const notificationOptions = (
    <ScmCollapsibleReveal
      open={alertRuleConfig.alertSetting !== RuleAction.CREATE_ALERT_LATER}
    >
      <ScmIssueAlertNotificationOptions {...notificationProps} />
    </ScmCollapsibleReveal>
  );

  const footer = (
    <Flex gap="sm" align="center">
      <IconInfo size="md" variant="secondary" />
      <Text variant="secondary" size="md" density="comfortable" ellipsis>
        {t('You can always change alerts after project creation')}
      </Text>
    </Flex>
  );

  if (collapsible) {
    // Summarize the current selection in the collapsed header.
    const alertSettingLabel: Record<RuleAction, [string, TagVariant]> = {
      [RuleAction.DEFAULT_ALERT]: [t('High priority issues'), 'info'],
      [RuleAction.CUSTOMIZED_ALERTS]: [t('Custom'), 'info'],
      [RuleAction.CREATE_ALERT_LATER]: [t('Off'), 'muted'],
    };

    // alertRuleConfig can come from restored session storage, so fall back to
    // the default if alertSetting holds an unknown value (avoids destructuring
    // undefined).
    const [label, variant] =
      alertSettingLabel[alertRuleConfig.alertSetting] ??
      alertSettingLabel[RuleAction.DEFAULT_ALERT];

    return (
      <ScmCollapsibleSection
        title={t('Alert frequency')}
        defaultExpanded={false}
        trailing={
          <Tag style={{minWidth: '0px'}} variant={variant}>
            <Text ellipsis variant="inherit">
              {label}
            </Text>
          </Tag>
        }
      >
        <Stack gap="lg">
          <ScmAlertFrequency {...alertRuleConfig} onFieldChange={onAlertChange} />
          {notificationOptions}
          {footer}
        </Stack>
      </ScmCollapsibleSection>
    );
  }

  return (
    <Stack gap="lg">
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
      {notificationOptions}
      {footer}
    </Stack>
  );
}
