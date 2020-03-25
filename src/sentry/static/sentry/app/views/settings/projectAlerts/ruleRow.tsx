import {Link} from 'react-router';
import {RouteComponentProps} from 'react-router/lib/Router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {IssueAlertRule} from 'app/types/alerts';
import {SavedIncidentRule} from 'app/views/settings/incidentRules/types';
import {getDisplayName} from 'app/utils/environment';
import {t, tct} from 'app/locale';
import recreateRoute from 'app/utils/recreateRoute';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';

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

        <TriggerAndActions>
          <div>
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
          </div>

          <Actions>
            {data.actions.map((action, i) => (
              <Action key={i}>{action.name}</Action>
            ))}
          </Actions>
        </TriggerAndActions>
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

    return (
      <React.Fragment>
        <RuleType>{t('Metric')}</RuleType>
        <div>
          {canEdit ? <RuleName to={editLink}>{data.name}</RuleName> : data.name}
          <RuleDescription />
        </div>

        <TriggerAndActions>
          {data.triggers.length !== 0 &&
            data.triggers.map((trigger, i) => (
              <React.Fragment key={i}>
                <Trigger key={`trigger-${i}`}>
                  <StatusBadge>{trigger.label}</StatusBadge>
                  <TriggerDescription>
                    {data.aggregations[0] === 0 ? t('Events') : t('Users')}{' '}
                    {trigger.thresholdType === 0 ? t('above') : t('below')}{' '}
                    {trigger.alertThreshold}/{data.timeWindow}
                    {t('min')}
                  </TriggerDescription>
                </Trigger>
                <Actions key={`actions-${i}`}>
                  {trigger.actions?.map((action, j) => (
                    <Action key={j}>{action.desc}</Action>
                  ))}
                </Actions>
              </React.Fragment>
            ))}
        </TriggerAndActions>
      </React.Fragment>
    );
  }

  render() {
    const {data} = this.props;

    return isIssueAlert(data) ? this.renderIssueRule(data) : this.renderMetricRule(data);
  }
}

export default RuleRow;

const RuleType = styled('div')`
  color: ${p => p.theme.gray3};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: bold;
  text-transform: uppercase;
`;

const RuleName = styled(Link)`
  font-weight: bold;
`;

const Conditions = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
`;

// For tests
const Actions = styled('div')`
  overflow: hidden;
`;

const Action = styled('div')`
  line-height: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TriggerAndActions = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: flex-start;
  grid-gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const MatchTypeHeader = styled('div')`
  font-weight: bold;
  text-transform: uppercase;
  color: ${p => p.theme.gray2};
  margin-bottom: ${space(1)};
`;

const RuleDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin: ${space(0.5)} 0;
`;

const Trigger = styled('div')`
  display: flex;
  overflow: hidden;
`;

const TriggerDescription = styled('div')`
  ${overflowEllipsis};
`;

const StatusBadge = styled('div')`
  background-color: ${p => p.theme.offWhite2};
  color: ${p => p.theme.gray4};
  text-transform: uppercase;
  padding: ${space(0.25)} ${space(0.5)};
  font-weight: 600;
  margin-right: ${space(0.5)};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;
