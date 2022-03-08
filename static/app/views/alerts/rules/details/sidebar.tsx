import * as React from 'react';
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
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Actor} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import {COMPARISON_DELTA_OPTIONS} from 'sentry/views/alerts/incidentRules/constants';
import {
  Action,
  AlertRuleThresholdType,
  AlertRuleTriggerType,
  IncidentRule,
} from 'sentry/views/alerts/incidentRules/types';

import {Incident, IncidentStatus} from '../../types';

type Props = {
  rule: IncidentRule;
  incidents?: Incident[];
};

export default class Sidebar extends React.Component<Props> {
  getTimeWindow(): React.ReactNode {
    const {rule} = this.props;

    if (!rule) {
      return '';
    }

    const {timeWindow} = rule;

    return tct('[window]', {
      window: <Duration seconds={timeWindow * 60} />,
    });
  }

  renderTrigger(label: string, threshold: number, actions: Action[]): React.ReactNode {
    const {rule} = this.props;

    if (!rule) {
      return null;
    }

    const status =
      label === AlertRuleTriggerType.CRITICAL
        ? t('Critical')
        : label === AlertRuleTriggerType.WARNING
        ? t('Warning')
        : t('Resolved');
    const statusIcon =
      label === AlertRuleTriggerType.CRITICAL ? (
        <StyledIconDiamond color="red300" size="md" />
      ) : label === AlertRuleTriggerType.WARNING ? (
        <StyledIconDiamond color="yellow300" size="md" />
      ) : (
        <StyledIconDiamond color="green300" size="md" />
      );

    const thresholdTypeText = (
      label === 'resolved'
        ? rule.thresholdType === AlertRuleThresholdType.BELOW
        : rule.thresholdType === AlertRuleThresholdType.ABOVE
    )
      ? rule.comparisonDelta
        ? t('higher')
        : t('above')
      : rule.comparisonDelta
      ? t('lower')
      : t('below');

    const thresholdText = rule.comparisonDelta
      ? tct(
          'When [threshold]% [comparisonType] in [timeWindow] compared to [comparisonDelta]',
          {
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
      : tct('If  [condition] in [timeWindow]', {
          condition: `${thresholdTypeText} ${threshold}`,
          timeWindow: this.getTimeWindow(),
        });

    return (
      <TriggerConditionContainer>
        {statusIcon}
        <TriggerCondition>
          {status}
          <TriggerText>{thresholdText}</TriggerText>
          {actions.map(
            action =>
              action.desc && <TriggerText key={action.id}>{action.desc}</TriggerText>
          )}
        </TriggerCondition>
      </TriggerConditionContainer>
    );
  }

  render() {
    const {incidents, rule} = this.props;

    // get current status
    const activeIncident = incidents?.find(({dateClosed}) => !dateClosed);
    const status = activeIncident ? activeIncident.status : IncidentStatus.CLOSED;

    const latestIncident = incidents?.length ? incidents[0] : null;
    // The date at which the alert was triggered or resolved
    const activityDate = activeIncident
      ? activeIncident.dateStarted
      : latestIncident
      ? latestIncident.dateClosed
      : null;

    const criticalTrigger = rule?.triggers.find(
      ({label}) => label === AlertRuleTriggerType.CRITICAL
    );
    const warningTrigger = rule?.triggers.find(
      ({label}) => label === AlertRuleTriggerType.WARNING
    );

    const ownerId = rule.owner?.split(':')[1];
    const teamActor = ownerId && {type: 'team' as Actor['type'], id: ownerId, name: ''};

    return (
      <React.Fragment>
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
        <React.Fragment>
          <SidebarGroup>
            <Heading>{t('Thresholds')}</Heading>
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
              this.renderTrigger('resolved', rule.resolveThreshold, [])}
          </SidebarGroup>

          <SidebarGroup>
            <Heading>{t('Alert Rule Details')}</Heading>
            <KeyValueTable>
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
                  value={<CreatedBy>{rule.createdBy.name ?? '-'}</CreatedBy>}
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
                  teamActor ? (
                    <ActorAvatar actor={teamActor} size={24} />
                  ) : (
                    t('Unassigned')
                  )
                }
              />
            </KeyValueTable>
          </SidebarGroup>
        </React.Fragment>
      </React.Fragment>
    );
  }
}

const SidebarGroup = styled('div')`
  margin-bottom: ${space(4)};
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
  margin-bottom: ${space(1.5)};
`;

const Heading = styled(SectionHeading)<{noMargin?: boolean}>`
  display: grid;
  grid-template-columns: auto auto;
  justify-content: flex-start;
  margin-top: ${p => (p.noMargin ? 0 : space(2))};
  margin-bottom: ${space(0.5)};
  line-height: 1;
  gap: ${space(1)};
`;

const TriggerConditionContainer = styled('div')`
  display: flex;
  flex-direction: row;
`;

const TriggerCondition = styled('div')`
  display: flex;
  flex-direction: column;
  margin-left: ${space(0.75)};
  line-height: 1.4;
  position: relative;
  top: 2px;
`;

const TriggerText = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const CreatedBy = styled('div')`
  ${overflowEllipsis}
`;

const StyledIconDiamond = styled(IconDiamond)`
  margin-top: ${space(0.5)};
`;
