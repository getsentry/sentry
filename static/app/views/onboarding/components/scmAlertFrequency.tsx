import {Input} from '@sentry/scraps/input';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {IconClock, IconFix, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ScmAlertOptionCard} from 'sentry/views/onboarding/components/scmAlertOptionCard';
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
    <Stack gap="xl" role="radiogroup" aria-label={t('Alert frequency')}>
      <ScmAlertOptionCard
        label={t('High priority issues')}
        icon={
          <IconWarning size="md" variant={isDefaultSelected ? 'accent' : 'secondary'} />
        }
        isSelected={isDefaultSelected}
        onSelect={() => onFieldChange('alertSetting', RuleAction.DEFAULT_ALERT)}
      />

      <ScmAlertOptionCard
        label={t('Custom')}
        icon={<IconFix size="md" variant={isCustomSelected ? 'accent' : 'secondary'} />}
        isSelected={isCustomSelected}
        onSelect={() => onFieldChange('alertSetting', RuleAction.CUSTOMIZED_ALERTS)}
      >
        <Container paddingLeft="2xl">
          <Stack
            gap="lg"
            padding="sm 0 0 2xl"
            borderLeft={isCustomSelected ? 'accent' : 'secondary'}
          >
            <Stack gap="xs">
              <Container>
                <Text size="md" density="comfortable">
                  {t('When there are more than')}
                </Text>
              </Container>
              <Grid gap="md" columns=".35fr .65fr">
                <Input
                  size="sm"
                  type="number"
                  min="0"
                  placeholder="10"
                  value={threshold}
                  onChange={e => onFieldChange('threshold', e.target.value)}
                  disabled={!isCustomSelected}
                />
                <Select
                  size="sm"
                  value={metric}
                  options={METRIC_CHOICES}
                  onChange={option => onFieldChange('metric', option.value)}
                  disabled={!isCustomSelected}
                />
              </Grid>
            </Stack>
            <Stack gap="xs">
              <Container>
                <Text size="md" density="comfortable">
                  {t('a unique error in')}
                </Text>
              </Container>
              <Select
                size="sm"
                value={interval}
                options={INTERVAL_CHOICES}
                onChange={option => onFieldChange('interval', option.value)}
                disabled={!isCustomSelected}
              />
            </Stack>
          </Stack>
        </Container>
      </ScmAlertOptionCard>

      <ScmAlertOptionCard
        label={t("I'll create my own alerts later")}
        icon={<IconClock size="md" variant={isLaterSelected ? 'accent' : 'secondary'} />}
        isSelected={isLaterSelected}
        onSelect={() => onFieldChange('alertSetting', RuleAction.CREATE_ALERT_LATER)}
      />
    </Stack>
  );
}
