import {useId} from 'react';

import {Input} from '@sentry/scraps/input';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';
import {ToggleCard} from '@sentry/scraps/toggleCard';

import {t} from 'sentry/locale';
import {
  INTERVAL_CHOICES,
  Interval,
} from 'sentry/views/automations/components/actionFilters/constants';
import {
  type AlertRuleOptions,
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
  interval = Interval.FIVE_MINUTES,
  metric = 0,
  threshold = '10',
  onFieldChange,
}: ScmAlertFrequencyProps) {
  const groupName = useId();
  const isDefaultSelected = alertSetting === RuleAction.DEFAULT_ALERT;
  const isCustomSelected = alertSetting === RuleAction.CUSTOMIZED_ALERTS;
  const isLaterSelected = alertSetting === RuleAction.CREATE_ALERT_LATER;

  return (
    <Stack gap="md" role="radiogroup" aria-label={t('Alert frequency')}>
      <ToggleCard
        variant="radio"
        name={groupName}
        value={RuleAction.DEFAULT_ALERT}
        padding="lg"
        aria-label={t('High priority issues')}
        checked={isDefaultSelected}
        onChange={() => onFieldChange('alertSetting', RuleAction.DEFAULT_ALERT)}
      >
        <Flex align="start" gap="md">
          <ToggleCard.Indicator />
          <Stack gap="xs">
            <Text bold size="sm" density="comfortable">
              {t('High priority issues')}
            </Text>
            <Text variant="secondary" size="sm" density="comfortable">
              {t('Alert on new, regressed, and escalating issues')}
            </Text>
          </Stack>
        </Flex>
      </ToggleCard>

      <ToggleCard
        variant="radio"
        name={groupName}
        value={RuleAction.CUSTOMIZED_ALERTS}
        padding="lg"
        aria-label={t('Custom threshold')}
        checked={isCustomSelected}
        onChange={() => onFieldChange('alertSetting', RuleAction.CUSTOMIZED_ALERTS)}
        details={
          <Stack gap="lg">
            <Stack gap="xs">
              <Text size="md" density="comfortable">
                {t('When there are more than')}
              </Text>
              <Grid gap="xl" columns={{zero: '1fr', '3xl': '1fr 1fr'}}>
                <Input
                  size="md"
                  type="number"
                  min="0"
                  aria-label={t('Alert threshold')}
                  placeholder="10"
                  value={threshold}
                  onChange={e => onFieldChange('threshold', e.target.value)}
                />
                <Select
                  size="md"
                  aria-label={t('Alert metric')}
                  value={metric}
                  options={METRIC_CHOICES}
                  onChange={option => onFieldChange('metric', option.value)}
                  menuPortalTarget={document.body}
                />
              </Grid>
            </Stack>
            <Stack gap="xs">
              <Text size="md" density="comfortable">
                {t('a unique error')}
              </Text>
              <Select
                size="md"
                aria-label={t('Alert interval')}
                value={interval}
                options={INTERVAL_CHOICES}
                onChange={option => onFieldChange('interval', option.value)}
                menuPortalTarget={document.body}
              />
            </Stack>
          </Stack>
        }
      >
        <Flex align="center" gap="md">
          <ToggleCard.Indicator />
          <Text bold size="sm" density="comfortable">
            {t('Custom threshold')}
          </Text>
        </Flex>
      </ToggleCard>

      <ToggleCard
        variant="radio"
        name={groupName}
        value={RuleAction.CREATE_ALERT_LATER}
        padding="lg"
        aria-label={t("I'll set up alerts later")}
        checked={isLaterSelected}
        onChange={() => onFieldChange('alertSetting', RuleAction.CREATE_ALERT_LATER)}
      >
        <Flex align="center" gap="md">
          <ToggleCard.Indicator />
          <Text bold size="sm" density="comfortable">
            {t("I'll set up alerts later")}
          </Text>
        </Flex>
      </ToggleCard>
    </Stack>
  );
}
