import {Link} from 'react-router';
import {RouteComponentProps} from 'react-router/lib/Router';
import {css} from '@emotion/core';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {IssueAlertRule} from 'app/types/alerts';
import {
  SavedIncidentRule,
  AlertRuleThresholdType,
} from 'app/views/settings/incidentRules/types';
import {getDisplayName} from 'app/utils/environment';
import {t, tct} from 'app/locale';
import recreateRoute from 'app/utils/recreateRoute';
import space from 'app/styles/space';

function isIssueAlert(data: IssueAlertRule | SavedIncidentRule): data is IssueAlertRule {
  return !data.hasOwnProperty('triggers');
}

type Props = {
  data: IssueAlertRule | SavedIncidentRule;
  type: 'issue' | 'metric';

  // Is the alert rule editable?
  canEdit?: boolean;
} & Pick<
  RouteComponentProps<{orgId: string; projectId: string}, {}>,
  'params' | 'routes' | 'location'
>;

type State = {
  loading: boolean;
  error: boolean;
};

class RuleRow extends React.Component<Props, State> {
  static propTypes: any = {
    data: PropTypes.object.isRequired,
    canEdit: PropTypes.bool,
  };

  state = {loading: false, error: false};

  renderIssueRule(data: IssueAlertRule) {
    const {params, routes, location, canEdit} = this.props;
    const editLink = recreateRoute(`rules/${data.id}/`, {
      params,
      routes,
      location,
    });

    const environmentName = data.environment
      ? getDisplayName({name: data.environment})
      : t('All Environments');

    return (
      <React.Fragment>
        <RuleType>{t('Issue')}</RuleType>
        <div>
          {canEdit ? <RuleName to={editLink}>{data.name}</RuleName> : data.name}
          <RuleDescription>
            {t('Environment')}: {environmentName}
          </RuleDescription>
        </div>

        <ConditionsWithHeader>
          <MatchTypeHeader>
            {tct('[matchType] of the following:', {
              matchType: data.actionMatch,
            })}
          </MatchTypeHeader>
          {data.conditions.length !== 0 && (
            <Conditions>
              {data.conditions.map((condition, i) => (
                <div key={i}>{condition.name}</div>
              ))}
            </Conditions>
          )}
        </ConditionsWithHeader>

        <Actions>
          {data.actions.map((action, i) => (
            <Action key={i}>{action.name}</Action>
          ))}
        </Actions>
      </React.Fragment>
    );
  }

  renderMetricRule(data: SavedIncidentRule) {
    const {params, routes, location, canEdit} = this.props;
    const editLink = recreateRoute(`metric-rules/${data.id}/`, {
      params,
      routes,
      location,
    });

    const numberOfTriggers = data.triggers.length;

    return (
      <React.Fragment>
        <RuleType rowSpans={numberOfTriggers}>{t('Metric')}</RuleType>
        <RuleNameAndDescription rowSpans={numberOfTriggers}>
          {canEdit ? <RuleName to={editLink}>{data.name}</RuleName> : data.name}
          <RuleDescription />
        </RuleNameAndDescription>

        {numberOfTriggers !== 0 &&
          data.triggers.map((trigger, i) => {
            const hideBorder = i !== numberOfTriggers - 1;
            return (
              <React.Fragment key={i}>
                <Trigger key={`trigger-${i}`} hideBorder={hideBorder}>
                  <StatusBadge>{trigger.label}</StatusBadge>
                  <TriggerDescription>
                    {data.aggregate}{' '}
                    {data.thresholdType === AlertRuleThresholdType.ABOVE
                      ? t('above')
                      : t('below')}{' '}
                    {trigger.alertThreshold}/{data.timeWindow}
                    {t('min')}
                  </TriggerDescription>
                </Trigger>
                <Actions key={`actions-${i}`} hideBorder={hideBorder}>
                  {trigger.actions?.length
                    ? trigger.actions.map((action, j) => (
                        <Action key={j}>{action.desc}</Action>
                      ))
                    : t('None')}
                </Actions>
              </React.Fragment>
            );
          })}
      </React.Fragment>
    );
  }

  render() {
    const {data} = this.props;

    return isIssueAlert(data) ? this.renderIssueRule(data) : this.renderMetricRule(data);
  }
}

export default RuleRow;

type RowSpansProp = {
  rowSpans?: number;
};

type HasBorderProp = {
  hideBorder?: boolean;
};

const RuleType = styled('div')<RowSpansProp>`
  color: ${p => p.theme.gray600};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: bold;
  text-transform: uppercase;
  ${p => p.rowSpans && `grid-row: auto / span ${p.rowSpans}`};
`;

const RuleNameAndDescription = styled('div')<RowSpansProp>`
  ${p => p.rowSpans && `grid-row: auto / span ${p.rowSpans}`};
`;

const RuleName = styled(Link)`
  font-weight: bold;
`;

const listingCss = css`
  display: grid;
  grid-gap: ${space(1)};
`;

const Conditions = styled('div')`
  ${listingCss};
`;

const Actions = styled('div')<HasBorderProp>`
  font-size: ${p => p.theme.fontSizeSmall};
  ${listingCss};

  ${p => p.hideBorder && `border-bottom: none`};
`;

const Action = styled('div')`
  line-height: 14px;
`;

const ConditionsWithHeader = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const MatchTypeHeader = styled('div')`
  font-weight: bold;
  text-transform: uppercase;
  color: ${p => p.theme.gray500};
  margin-bottom: ${space(1)};
`;

const RuleDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin: ${space(0.5)} 0;
  white-space: nowrap;
`;

const Trigger = styled('div')<HasBorderProp>`
  display: flex;
  align-items: flex-start;
  font-size: ${p => p.theme.fontSizeSmall};

  ${p => p.hideBorder && `border-bottom: none`};
`;

const TriggerDescription = styled('div')`
  white-space: nowrap;
`;

const StatusBadge = styled('div')`
  background-color: ${p => p.theme.gray300};
  color: ${p => p.theme.gray700};
  text-transform: uppercase;
  padding: ${space(0.25)} ${space(0.5)};
  font-weight: 600;
  margin-right: ${space(0.5)};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;
