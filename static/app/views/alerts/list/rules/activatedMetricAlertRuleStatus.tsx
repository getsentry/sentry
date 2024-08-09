import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {IconArrow, IconMute} from 'sentry/icons';
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

import type {MetricAlert} from '../../types';
import {IncidentStatus} from '../../types';

interface Props {
  rule: MetricAlert;
}

export default function ActivatedMetricAlertRuleStatus({rule}: Props): ReactNode {
  if (rule.snooze) {
    return (
      <IssueAlertStatusWrapper>
        <IconMute size="sm" color="subText" />
        {t('Muted')}
      </IssueAlertStatusWrapper>
    );
  }

  const isUnhealthy = hasActiveIncident(rule);

  let iconColor: ColorOrAlias = 'successText';
  let iconDirection: 'up' | 'down' =
    rule.thresholdType === AlertRuleThresholdType.ABOVE ? 'down' : 'up';
  let thresholdTypeText =
    rule.thresholdType === AlertRuleThresholdType.ABOVE ? t('Below') : t('Above');
  if (isUnhealthy) {
    iconColor =
      rule.latestIncident?.status === IncidentStatus.CRITICAL
        ? 'errorText'
        : 'warningText';
    // if unhealthy, swap icon direction
    iconDirection = rule.thresholdType === AlertRuleThresholdType.ABOVE ? 'up' : 'down';
    thresholdTypeText =
      rule.thresholdType === AlertRuleThresholdType.ABOVE ? t('Above') : t('Below');
  }

  let threshold = rule.triggers.find(
    ({label}) => label === AlertRuleTriggerType.CRITICAL
  )?.alertThreshold;
  if (isUnhealthy && rule.latestIncident?.status === IncidentStatus.WARNING) {
    threshold = rule.triggers.find(
      ({label}) => label === AlertRuleTriggerType.WARNING
    )?.alertThreshold;
  } else if (!isUnhealthy && rule.latestIncident && rule.resolveThreshold) {
    threshold = rule.resolveThreshold;
  }

  return (
    <FlexCenter>
      <IconArrow color={iconColor} direction={iconDirection} />
      <TriggerText>
        {`${thresholdTypeText} ${threshold}`}
        {getThresholdUnits(
          rule.aggregate,
          rule.comparisonDelta
            ? AlertRuleComparisonType.CHANGE
            : AlertRuleComparisonType.COUNT
        )}
      </TriggerText>
    </FlexCenter>
  );
}

// TODO: see static/app/components/profiling/flex.tsx and utilize the FlexContainer styled component
const FlexCenter = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

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
