import {Input} from '@sentry/scraps/input';
import {Grid, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {ScmAlertOptionCard} from 'sentry/components/onboarding/scm/scmAlertOptionCard';
import {t} from 'sentry/locale';
import {
  type AlertRuleOptions,
  INTERVAL_CHOICES,
  METRIC_CHOICES,
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
  interval = '1m',
  metric = 0,
  threshold = '10',
  onFieldChange,
}: ScmAlertFrequencyProps) {
  const isDefaultSelected = alertSetting === RuleAction.DEFAULT_ALERT;
  const isCustomSelected = alertSetting === RuleAction.CUSTOMIZED_ALERTS;
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
        label={t('Custom threshold')}
        isSelected={isCustomSelected}
        onSelect={() => onFieldChange('alertSetting', RuleAction.CUSTOMIZED_ALERTS)}
      >
        {isCustomSelected && (
          <Stack gap="lg">
            <Stack gap="xs">
              <Text size="md" density="comfortable">
                {t('When there are more than')}
              </Text>
              <Grid gap="xl" columns={{'screen:sm': '1fr', 'screen:md': '1fr 1fr'}}>
                <Input
                  size="md"
                  type="number"
                  min="0"
                  placeholder="10"
                  value={threshold}
                  onChange={e => onFieldChange('threshold', e.target.value)}
                />
                <Select
                  size="md"
                  value={metric}
                  options={METRIC_CHOICES}
                  onChange={option => onFieldChange('metric', option.value)}
                  menuPortalTarget={document.body}
                />
              </Grid>
            </Stack>
            <Stack gap="xs">
              <Text size="md" density="comfortable">
                {t('a unique error in')}
              </Text>
              <Select
                size="md"
                value={interval}
                options={INTERVAL_CHOICES}
                onChange={option => onFieldChange('interval', option.value)}
                menuPortalTarget={document.body}
              />
            </Stack>
          </Stack>
        )}
      </ScmAlertOptionCard>

      <ScmAlertOptionCard
        label={t("I'll set up alerts later")}
        isSelected={isLaterSelected}
        onSelect={() => onFieldChange('alertSetting', RuleAction.CREATE_ALERT_LATER)}
      />
    </Stack>
  );
}
