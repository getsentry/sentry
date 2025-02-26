import {Fragment} from 'react';
import styled from '@emotion/styled';

import {OnDemandWarningIcon} from 'sentry/components/alerts/onDemandMetricAlert';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import AlertBadge from 'sentry/components/badge/alertBadge';
import {Button} from 'sentry/components/button';
import {SectionHeading} from 'sentry/components/charts/styles';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import TimeSince from 'sentry/components/timeSince';
import {IconDiamond, IconMegaphone} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Actor} from 'sentry/types/core';
import getDynamicText from 'sentry/utils/getDynamicText';
import {getSearchFilters, isOnDemandSearchKey} from 'sentry/utils/onDemandMetrics/index';
import {capitalize} from 'sentry/utils/string/capitalize';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {COMPARISON_DELTA_OPTIONS} from 'sentry/views/alerts/rules/metric/constants';
import type {Action, MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {
  AlertRuleComparisonType,
  AlertRuleThresholdType,
  AlertRuleTriggerType,
} from 'sentry/views/alerts/rules/metric/types';
import {IncidentStatus} from 'sentry/views/alerts/types';
import {AlertWizardAlertNames} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';

interface MetricDetailsSidebarProps {
  rule: MetricRule;
  showOnDemandMetricAlertUI: boolean;
}

function TriggerDescription({
  rule,
  actions,
  label,
  threshold,
}: {
  actions: Action[];
  label: string;
  rule: MetricRule;
  threshold: number;
}) {
  const status =
    label === AlertRuleTriggerType.CRITICAL
      ? t('Critical')
      : label === AlertRuleTriggerType.WARNING
        ? t('Warning')
        : t('Resolved');

  const statusIconColor =
    label === AlertRuleTriggerType.CRITICAL
      ? 'errorText'
      : label === AlertRuleTriggerType.WARNING
        ? 'warningText'
        : 'successText';

  const defaultAction = t('Change alert status to %s', status);

  const aboveThreshold =
    label === AlertRuleTriggerType.RESOLVE
      ? rule.thresholdType === AlertRuleThresholdType.BELOW
      : rule.thresholdType === AlertRuleThresholdType.ABOVE;

  const thresholdTypeText = aboveThreshold
    ? rule.comparisonDelta
      ? t('higher')
      : t('above')
    : rule.comparisonDelta
      ? t('lower')
      : t('below');
  const timeWindow = <Duration seconds={rule.timeWindow * 60} />;
  const metricName = capitalize(
    AlertWizardAlertNames[getAlertTypeFromAggregateDataset(rule)]
  );

  const thresholdText = rule.comparisonDelta
    ? tct(
        '[metric] is [threshold]% [comparisonType] in [timeWindow] compared to the [comparisonDelta]',
        {
          metric: metricName,
          threshold,
          comparisonType: thresholdTypeText,
          timeWindow,
          comparisonDelta: (
            COMPARISON_DELTA_OPTIONS.find(({value}) => value === rule.comparisonDelta) ??
            COMPARISON_DELTA_OPTIONS[0]!
          ).label,
        }
      )
    : rule.detectionType === AlertRuleComparisonType.DYNAMIC
      ? 'Anomaly detection threshold is reached'
      : tct('[metric] is [condition] in [timeWindow]', {
          metric: metricName,
          condition: `${thresholdTypeText} ${threshold}`,
          timeWindow,
        });

  return (
    <TriggerContainer>
      <TriggerTitle>
        <IconDiamond color={statusIconColor} size="xs" />
        <TriggerTitleText>{t('%s Conditions', status)}</TriggerTitleText>
      </TriggerTitle>
      <TriggerStep>
        <TriggerTitleText>{t('When')}</TriggerTitleText>
        <TriggerActions>
          <TriggerText>
            {thresholdText}
            {rule.detectionType === AlertRuleComparisonType.DYNAMIC ? (
              <FeatureBadge
                type="alpha"
                tooltipProps={{
                  title: t(
                    'Anomaly detection is in alpha and may produce inaccurate results'
                  ),
                  isHoverable: true,
                }}
              />
            ) : null}
          </TriggerText>
        </TriggerActions>
      </TriggerStep>
      <TriggerStep>
        <TriggerTitleText>{t('Then')}</TriggerTitleText>
        <TriggerActions>
          {actions.map(action => (
            <TriggerText key={action.id}>{action.desc}</TriggerText>
          ))}
          <TriggerText>{defaultAction}</TriggerText>
        </TriggerActions>
      </TriggerStep>
    </TriggerContainer>
  );
}

export function MetricDetailsSidebar({
  rule,
  showOnDemandMetricAlertUI,
}: MetricDetailsSidebarProps) {
  // get current status
  const latestIncident = rule.latestIncident;

  const status = latestIncident ? latestIncident.status : IncidentStatus.CLOSED;
  // The date at which the alert was triggered or resolved
  const activityDate = latestIncident?.dateClosed ?? latestIncident?.dateStarted ?? null;

  const criticalTrigger = rule.triggers.find(
    ({label}) => label === AlertRuleTriggerType.CRITICAL
  );
  const warningTrigger = rule.triggers.find(
    ({label}) => label === AlertRuleTriggerType.WARNING
  );

  const ownerId = rule.owner?.split(':')[1];
  const teamActor = ownerId && {type: 'team' as Actor['type'], id: ownerId, name: ''};
  const openForm = useFeedbackForm();

  const feedbackButton = openForm ? (
    <Button
      onClick={() => {
        openForm({
          formTitle: 'Anomaly Detection Feedback',
          messagePlaceholder: t(
            'How can we make alerts using anomaly detection more useful?'
          ),
          tags: {
            ['feedback.source']: 'dynamic_thresholding',
            ['feedback.owner']: 'ml-ai',
          },
        });
      }}
      size="xs"
      icon={<IconMegaphone />}
    >
      Give Feedback
    </Button>
  ) : null;

  return (
    <Fragment>
      <StatusContainer>
        <HeaderItem>
          <SectionHeading>{t('Alert Status')}</SectionHeading>
          <Status>
            <AlertBadge status={status} withText />
          </Status>
        </HeaderItem>
        <HeaderItem>
          <SectionHeading>{t('Last Triggered')}</SectionHeading>
          <Status>
            {activityDate ? <TimeSince date={activityDate} /> : t('No alerts triggered')}
          </Status>
        </HeaderItem>
      </StatusContainer>
      <SidebarGroup>
        {typeof criticalTrigger?.alertThreshold === 'number' && (
          <TriggerDescription
            rule={rule}
            label={criticalTrigger.label}
            threshold={criticalTrigger.alertThreshold}
            actions={criticalTrigger.actions}
          />
        )}
        {typeof warningTrigger?.alertThreshold === 'number' && (
          <TriggerDescription
            rule={rule}
            label={warningTrigger.label}
            actions={warningTrigger.actions}
            threshold={warningTrigger.alertThreshold}
          />
        )}
        {typeof rule.resolveThreshold === 'number' && (
          <TriggerDescription
            rule={rule}
            label={AlertRuleTriggerType.RESOLVE}
            threshold={rule.resolveThreshold}
            actions={[]}
          />
        )}
      </SidebarGroup>
      {showOnDemandMetricAlertUI && (
        <SidebarGroup>
          <SectionHeading>{t('Filters Used')}</SectionHeading>
          <KeyValueTable>
            {getSearchFilters(rule.query).map(({key, operator, value}) => (
              <FilterKeyValueTableRow
                key={key}
                keyName={key}
                operator={operator}
                value={value}
              />
            ))}
          </KeyValueTable>
        </SidebarGroup>
      )}
      <SidebarGroup>
        <SectionHeading>{t('Alert Rule Details')}</SectionHeading>
        <KeyValueTable>
          <KeyValueTableRow
            keyName={t('Environment')}
            value={<OverflowTableValue>{rule.environment ?? '-'}</OverflowTableValue>}
          />
          <KeyValueTableRow
            keyName={t('Date created')}
            value={
              <DateTime
                date={getDynamicText({
                  value: rule.dateCreated,
                  fixed: new Date('2021-04-20'),
                })}
                format="ll"
              />
            }
          />
          {rule.createdBy && (
            <KeyValueTableRow
              keyName={t('Created by')}
              value={
                <OverflowTableValue>{rule.createdBy.name ?? '-'}</OverflowTableValue>
              }
            />
          )}
          {rule.dateModified && (
            <KeyValueTableRow
              keyName={t('Last modified')}
              value={<TimeSince date={rule.dateModified} suffix={t('ago')} />}
            />
          )}
          <KeyValueTableRow
            keyName={t('Team')}
            value={
              teamActor ? <ActorAvatar actor={teamActor} size={24} /> : t('Unassigned')
            }
          />
          {rule.detectionType === AlertRuleComparisonType.DYNAMIC && (
            <KeyValueTableRow
              keyName={t('Responsiveness')}
              value={
                rule.sensitivity
                  ? rule.sensitivity.charAt(0).toUpperCase() + rule.sensitivity.slice(1)
                  : ''
              } // NOTE: if the rule is dynamic, then there must be a sensitivity
            />
          )}
          {rule.detectionType === AlertRuleComparisonType.DYNAMIC && (
            <KeyValueTableRow
              keyName={t('Direction')}
              value={
                <OverflowTableValue>
                  {rule.thresholdType === AlertRuleThresholdType.ABOVE
                    ? 'Above threshold'
                    : rule.thresholdType === AlertRuleThresholdType.ABOVE_AND_BELOW
                      ? 'Above and below threshold'
                      : 'Below threshold'}
                </OverflowTableValue>
              }
            />
          )}
        </KeyValueTable>
      </SidebarGroup>
      {rule.detectionType === AlertRuleComparisonType.DYNAMIC && feedbackButton}
    </Fragment>
  );
}

function FilterKeyValueTableRow({
  keyName,
  operator,
  value,
}: {
  keyName: string;
  operator: string;
  value: string;
}) {
  return (
    <KeyValueTableRow
      keyName={
        <KeyWrapper>
          {isOnDemandSearchKey(keyName) && (
            <span>
              <OnDemandWarningIcon
                msg={t(
                  'We don’t routinely collect metrics from this property. As such, historical data may be limited.'
                )}
              />
            </span>
          )}

          {keyName}
        </KeyWrapper>
      }
      value={
        <OverflowTableValue>
          {operator} {value}
        </OverflowTableValue>
      }
    />
  );
}

const KeyWrapper = styled('div')`
  display: flex;
  gap: ${space(0.75)};

  > span {
    margin-top: ${space(0.25)};
    height: ${space(2)};
  }
`;

const SidebarGroup = styled('div')`
  margin-bottom: ${space(3)};
`;

const HeaderItem = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;

  > *:nth-child(2) {
    flex: 1;
    display: flex;
    align-items: center;
  }
`;

const Status = styled('div')`
  position: relative;
  display: grid;
  grid-template-columns: auto auto auto;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeLarge};
`;

const StatusContainer = styled('div')`
  height: 60px;
  display: flex;
  margin-bottom: ${space(2)};

  h4 {
    margin-top: 0;
  }
`;

const OverflowTableValue = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;

const TriggerContainer = styled('div')`
  display: grid;
  grid-template-rows: auto auto auto;
  gap: ${space(1)};
  margin-top: ${space(4)};
`;

const TriggerTitle = styled('div')`
  display: grid;
  grid-template-columns: 20px 1fr;
  align-items: center;
`;

const TriggerTitleText = styled('h4')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  line-height: 24px;
  min-width: 40px;
`;

const TriggerStep = styled('div')`
  display: grid;
  grid-template-columns: 40px 1fr;
  align-items: stretch;
`;

const TriggerActions = styled('div')`
  display: grid;
  grid-template-columns: repeat(1fr);
  gap: ${space(0.25)};
  align-items: center;
`;

const TriggerText = styled('span')`
  display: block;
  background-color: ${p => p.theme.surface200};
  padding: ${space(0.25)} ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  width: 100%;
  font-weight: ${p => p.theme.fontWeightNormal};
`;
