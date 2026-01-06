import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {IconArrow, IconMute, IconNot} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ColorOrAlias} from 'sentry/utils/theme';
import {hasActiveIncident} from 'sentry/views/alerts/list/rules/utils';
import {getThresholdUnits} from 'sentry/views/alerts/rules/metric/constants';
import {
  AlertRuleComparisonType,
  AlertRuleThresholdType,
  AlertRuleTriggerType,
} from 'sentry/views/alerts/rules/metric/types';
import {IncidentStatus, type CombinedMetricIssueAlerts} from 'sentry/views/alerts/types';
import {isIssueAlert} from 'sentry/views/alerts/utils';

interface Props {
  rule: CombinedMetricIssueAlerts;
}

export default function AlertRuleStatus({rule}: Props) {
  const activeIncident = hasActiveIncident(rule);

  function renderSnoozeStatus(): React.ReactNode {
    return (
      <IssueAlertStatusWrapper>
        <IconMute size="sm" variant="muted" />
        {t('Muted')}
      </IssueAlertStatusWrapper>
    );
  }

  if (isIssueAlert(rule)) {
    if (rule.status === 'disabled') {
      return (
        <IssueAlertStatusWrapper>
          <IconNot size="sm" variant="muted" />
          {t('Disabled')}
        </IssueAlertStatusWrapper>
      );
    }
    if (rule.snooze) {
      return renderSnoozeStatus();
    }
    return null;
  }

  if (rule.snooze) {
    return renderSnoozeStatus();
  }

  const criticalTrigger = rule.triggers.find(
    ({label}: any) => label === AlertRuleTriggerType.CRITICAL
  );
  const warningTrigger = rule.triggers.find(
    ({label}: any) => label === AlertRuleTriggerType.WARNING
  );
  const resolvedTrigger = rule.resolveThreshold;

  const trigger =
    activeIncident && rule.latestIncident?.status === IncidentStatus.CRITICAL
      ? criticalTrigger
      : (warningTrigger ?? criticalTrigger);

  let iconColor: ColorOrAlias = 'success';
  let iconDirection: 'up' | 'down' | undefined;
  let thresholdTypeText =
    activeIncident && rule.thresholdType === AlertRuleThresholdType.ABOVE
      ? t('Above')
      : t('Below');

  // Anomaly detection alerts have different labels
  const statusLabel = activeIncident ? t('Critical') : t('Resolved');

  if (activeIncident) {
    iconColor =
      trigger?.label === AlertRuleTriggerType.CRITICAL
        ? 'danger'
        : trigger?.label === AlertRuleTriggerType.WARNING
          ? 'warning'
          : 'success';
    iconDirection = rule.thresholdType === AlertRuleThresholdType.ABOVE ? 'up' : 'down';
  } else {
    // Use the Resolved threshold type, which is opposite of Critical
    iconDirection = rule.thresholdType === AlertRuleThresholdType.ABOVE ? 'down' : 'up';
    thresholdTypeText =
      rule.thresholdType === AlertRuleThresholdType.ABOVE ? t('Below') : t('Above');
  }

  return (
    <Flex align="center">
      {rule.detectionType !== AlertRuleComparisonType.DYNAMIC && (
        <IconArrow variant={iconColor} direction={iconDirection} />
      )}
      {rule.detectionType === AlertRuleComparisonType.DYNAMIC ? (
        <TriggerText>{statusLabel}</TriggerText>
      ) : (
        <TriggerText>
          {`${thresholdTypeText} ${
            rule.latestIncident || (!rule.latestIncident && !resolvedTrigger)
              ? trigger?.alertThreshold?.toLocaleString()
              : resolvedTrigger?.toLocaleString()
          }`}
          {getThresholdUnits(
            rule.aggregate,
            rule.comparisonDelta
              ? AlertRuleComparisonType.CHANGE
              : AlertRuleComparisonType.COUNT
          )}
        </TriggerText>
      )}
    </Flex>
  );
}

const IssueAlertStatusWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  line-height: 2;
`;

const TriggerText = styled('div')`
  margin-left: ${space(1)};
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
`;
