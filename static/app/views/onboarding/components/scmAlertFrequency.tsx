import {AnimatePresence, motion} from 'framer-motion';

import {Input} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {IconClock, IconFix, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {testableTransition} from 'sentry/utils/testableTransition';
import {
  type IssueAlertNotificationProps,
  IssueAlertNotificationOptions,
} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
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
  notificationProps?: IssueAlertNotificationProps;
}

interface AlertOptionCardProps {
  icon: React.ReactNode;
  isSelected: boolean;
  label: string;
  onSelect: () => void;
  children?: React.ReactNode;
}

function AlertOptionCard({
  label,
  icon,
  isSelected,
  onSelect,
  children,
}: AlertOptionCardProps) {
  return (
    <Stack gap="md">
      <Container
        border={isSelected ? 'accent' : 'secondary'}
        padding="lg"
        radius="md"
        style={isSelected ? {marginBottom: 1} : {borderBottomWidth: 2}}
        role="radio"
        aria-checked={isSelected}
        onClick={onSelect}
        tabIndex={0}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <Flex gap="md" align="center">
          <Container padding="xs 0 0 0">
            <Radio size="sm" readOnly checked={isSelected} tabIndex={-1} />
          </Container>
          <Text
            bold={isSelected}
            style={{flex: 1, lineHeight: '22px'}}
            size="md"
            density="comfortable"
          >
            {label}
          </Text>
          <Flex align="center" style={{paddingTop: 2}}>
            {icon}
          </Flex>
        </Flex>
      </Container>
      {children}
    </Stack>
  );
}

export function ScmAlertFrequency({
  alertSetting = RuleAction.DEFAULT_ALERT,
  interval = '1m',
  metric = 0,
  threshold = '10',
  notificationProps,
  onFieldChange,
}: ScmAlertFrequencyProps) {
  const isDefaultSelected = alertSetting === RuleAction.DEFAULT_ALERT;
  const isCustomSelected = alertSetting === RuleAction.CUSTOMIZED_ALERTS;
  const isLaterSelected = alertSetting === RuleAction.CREATE_ALERT_LATER;

  return (
    <Stack gap="xl" role="radiogroup" aria-label={t('Alert frequency')}>
      <Stack gap="lg">
        <AlertOptionCard
          label={t('High priority issues')}
          icon={
            <IconWarning size="md" variant={isDefaultSelected ? 'accent' : 'secondary'} />
          }
          isSelected={isDefaultSelected}
          onSelect={() => onFieldChange('alertSetting', RuleAction.DEFAULT_ALERT)}
        />

        <AlertOptionCard
          label={t('Custom')}
          icon={<IconFix size="md" variant={isCustomSelected ? 'accent' : 'secondary'} />}
          isSelected={isCustomSelected}
          onSelect={() => onFieldChange('alertSetting', RuleAction.CUSTOMIZED_ALERTS)}
        >
          <AnimatePresence initial={false}>
            {isCustomSelected && (
              <motion.div
                initial={{height: 0, opacity: 0}}
                animate={{
                  height: 'auto',
                  opacity: 1,
                  transition: testableTransition({duration: 0.2}),
                }}
                exit={{
                  height: 0,
                  opacity: 0,
                  transition: testableTransition({duration: 0.15}),
                }}
                style={{overflow: 'hidden'}}
              >
                <Flex paddingLeft="3xl">
                  <Stack
                    gap="md"
                    paddingLeft="3xl"
                    width="100%"
                    style={{
                      borderLeft: `2px solid var(--border-accent, var(--accent400))`,
                    }}
                  >
                    <Stack gap="xs" width="100%">
                      <Text size="md" density="comfortable">
                        {t('When there are more than')}
                      </Text>
                      <Flex gap="md" width="100%">
                        <div style={{width: 91}}>
                          <Input
                            size="sm"
                            type="number"
                            min="0"
                            placeholder="10"
                            value={threshold}
                            onChange={e => onFieldChange('threshold', e.target.value)}
                          />
                        </div>
                        <div style={{flex: 1}}>
                          <Select
                            size="sm"
                            value={metric}
                            options={METRIC_CHOICES}
                            onChange={option => onFieldChange('metric', option.value)}
                          />
                        </div>
                      </Flex>
                    </Stack>
                    <Stack gap="xs" width="100%">
                      <Text size="md" density="comfortable">
                        {t('a unique error in')}
                      </Text>
                      <Select
                        size="sm"
                        value={interval}
                        options={INTERVAL_CHOICES}
                        onChange={option => onFieldChange('interval', option.value)}
                      />
                    </Stack>
                  </Stack>
                </Flex>
              </motion.div>
            )}
          </AnimatePresence>
        </AlertOptionCard>

        <AlertOptionCard
          label={t("I'll create my own alerts later")}
          icon={
            <IconClock size="md" variant={isLaterSelected ? 'accent' : 'secondary'} />
          }
          isSelected={isLaterSelected}
          onSelect={() => onFieldChange('alertSetting', RuleAction.CREATE_ALERT_LATER)}
        />
      </Stack>

      {notificationProps && alertSetting !== RuleAction.CREATE_ALERT_LATER && (
        <IssueAlertNotificationOptions {...notificationProps} />
      )}
    </Stack>
  );
}
