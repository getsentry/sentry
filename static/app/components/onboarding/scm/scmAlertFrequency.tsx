import {Stack} from '@sentry/scraps/layout';

import {ScmAlertOptionCard} from 'sentry/components/onboarding/scm/scmAlertOptionCard';
import {t} from 'sentry/locale';
import {
  type AlertRuleOptions,
  RuleAction,
} from 'sentry/views/projectInstall/issueAlertOptions';

interface ScmAlertFrequencyProps extends Partial<AlertRuleOptions> {
  onFieldChange: <K extends keyof AlertRuleOptions>(
    key: K,
    value: AlertRuleOptions[K]
  ) => void;
}

export function ScmAlertFrequency({
  alertSetting = RuleAction.DEFAULT_ALERT,
  onFieldChange,
}: ScmAlertFrequencyProps) {
  const isDefaultSelected = alertSetting === RuleAction.DEFAULT_ALERT;
  const isLaterSelected = alertSetting === RuleAction.CREATE_ALERT_LATER;

  return (
    <Stack gap="md" role="radiogroup" aria-label={t('Alert frequency')}>
      <ScmAlertOptionCard
        label={t('High priority issues')}
        description={t('Alert on new, regressed, and escalating issues')}
        isSelected={isDefaultSelected}
        onSelect={() => onFieldChange('alertSetting', RuleAction.DEFAULT_ALERT)}
      />

      <ScmAlertOptionCard
        label={t("I'll set up alerts later")}
        isSelected={isLaterSelected}
        onSelect={() => onFieldChange('alertSetting', RuleAction.CREATE_ALERT_LATER)}
      />
    </Stack>
  );
}
