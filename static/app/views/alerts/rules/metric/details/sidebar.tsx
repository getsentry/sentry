import {Fragment, PureComponent, ReactNode} from 'react';
import styled from '@emotion/styled';

import AlertBadge from 'sentry/components/alertBadge';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {SectionHeading} from 'sentry/components/charts/styles';
import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import TimeSince from 'sentry/components/timeSince';
import {IconDiamond} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Actor} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import {COMPARISON_DELTA_OPTIONS} from 'sentry/views/alerts/rules/metric/constants';
import {
  Action,
  AlertRuleThresholdType,
  AlertRuleTriggerType,
  MetricRule,
} from 'sentry/views/alerts/rules/metric/types';
import {AlertWizardAlertNames} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';

import {IncidentStatus} from '../../../types';

interface Props {
  rule: MetricRule;
}

export default class Sidebar extends PureComponent<Props> {
  getTimeWindow(): ReactNode {
    const {rule} = this.props;

    if (!rule) {
      return '';
    }

    const {timeWindow} = rule;

    return tct('[window]', {
      window: <Duration seconds={timeWindow * 60} />,
    });
  }

  renderTrigger(label: string, threshold: number, actions: Action[]): ReactNode {
    const {rule} = this.props;

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

    const thresholdText = rule.comparisonDelta
      ? tct(
          '[metric] is [threshold]% [comparisonType] in [timeWindow] compared to [comparisonDelta]',
          {
            metric: AlertWizardAlertNames[getAlertTypeFromAggregateDataset(rule)],
            threshold,
            comparisonType: thresholdTypeText,
            timeWindow: this.getTimeWindow(),
            comparisonDelta: (
              COMPARISON_DELTA_OPTIONS.find(
                ({value}) => value === rule.comparisonDelta
              ) ?? COMPARISON_DELTA_OPTIONS[0]
            ).label,
          }
        )
      : tct('[metric] is [condition] in [timeWindow]', {
          metric: AlertWizardAlertNames[getAlertTypeFromAggregateDataset(rule)],
          condition: `${thresholdTypeText} ${threshold}`,
          timeWindow: this.getTimeWindow(),
        });

    return (
      <TriggerContainer>
        <TriggerTitle>
          <IconDiamond color={statusIconColor} size="xs" />
          <TriggerTitleText>{t('%s Conditions', status)}</TriggerTitleText>
        </TriggerTitle>
        <TriggerStep>
          <TriggerTitleText>When</TriggerTitleText>
          <TriggerActions>
            <TriggerText>{thresholdText}</TriggerText>
          </TriggerActions>
        </TriggerStep>
        <TriggerStep>
          <TriggerTitleText>Then</TriggerTitleText>
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

  render() {
    const {rule} = this.props;

    // get current status
    const latestIncident = rule.latestIncident;
    const status = latestIncident ? latestIncident.status : IncidentStatus.CLOSED;
    // The date at which the alert was triggered or resolved
    const activityDate =
      latestIncident?.dateClosed ?? latestIncident?.dateStarted ?? null;

    const criticalTrigger = rule?.triggers.find(
      ({label}) => label === AlertRuleTriggerType.CRITICAL
    );
    const warningTrigger = rule?.triggers.find(
      ({label}) => label === AlertRuleTriggerType.WARNING
    );

    const ownerId = rule.owner?.split(':')[1];
    const teamActor = ownerId && {type: 'team' as Actor['type'], id: ownerId, name: ''};

    return (
      <Fragment>
        <StatusContainer>
          <HeaderItem>
            <Heading noMargin>{t('Alert Status')}</Heading>
            <Status>
              <AlertBadge status={status} />
            </Status>
          </HeaderItem>
          <HeaderItem>
            <Heading noMargin>{t('Last Triggered')}</Heading>
            <Status>
              {activityDate ? (
                <TimeSince date={activityDate} />
              ) : (
                t('No alerts triggered')
              )}
            </Status>
          </HeaderItem>
        </StatusContainer>
        <SidebarGroup>
          {typeof criticalTrigger?.alertThreshold === 'number' &&
            this.renderTrigger(
              criticalTrigger.label,
              criticalTrigger.alertThreshold,
              criticalTrigger.actions
            )}
          {typeof warningTrigger?.alertThreshold === 'number' &&
            this.renderTrigger(
              warningTrigger.label,
              warningTrigger.alertThreshold,
              warningTrigger.actions
            )}
          {typeof rule.resolveThreshold === 'number' &&
            this.renderTrigger(AlertRuleTriggerType.RESOLVE, rule.resolveThreshold, [])}
        </SidebarGroup>

        <SidebarGroup>
          <Heading>{t('Alert Rule Details')}</Heading>
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
                keyName={t('Created By')}
                value={
                  <OverflowTableValue>{rule.createdBy.name ?? '-'}</OverflowTableValue>
                }
              />
            )}

            {rule.dateModified && (
              <KeyValueTableRow
                keyName={t('Last Modified')}
                value={<TimeSince date={rule.dateModified} suffix={t('ago')} />}
              />
            )}

            <KeyValueTableRow
              keyName={t('Team')}
              value={
                teamActor ? <ActorAvatar actor={teamActor} size={24} /> : t('Unassigned')
              }
            />
          </KeyValueTable>
        </SidebarGroup>
      </Fragment>
    );
  }
}

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
  margin-bottom: ${space(1)};
`;

const Heading = styled(SectionHeading)<{noMargin?: boolean}>`
  margin-top: ${p => (p.noMargin ? 0 : space(2))};
  margin-bottom: ${p => (p.noMargin ? 0 : space(1))};
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
  background-color: ${p => p.theme.surface100};
  padding: ${space(0.25)} ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  width: 100%;
  font-weight: 400;
`;
