import {Link} from 'react-router';
import {RouteComponentProps} from 'react-router/lib/Router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {IssueAlertRule} from 'app/types/alerts';
import {PanelItem} from 'app/components/panels';
import {SavedIncidentRule} from 'app/views/settings/incidentRules/types';
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
      <RuleItem>
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
                {data.conditions.map((condition, i) => {
                  return <div key={i}>{condition.name}</div>;
                })}
              </Conditions>
            )}
          </div>

          <div>
            {data.actions.map((action, i) => {
              return <div key={i}>{action.name}</div>;
            })}
          </div>
        </TriggerAndActions>
      </RuleItem>
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
      <RuleItem>
        <RuleType>{t('Metric')}</RuleType>
        <div>
          {canEdit ? <RuleName to={editLink}>{data.name}</RuleName> : data.name}
          <RuleDescription />
        </div>

        <div>
          {data.triggers.length !== 0 &&
            data.triggers.map((trigger, i) => {
              return (
                <TriggerAndActions key={i}>
                  <Trigger>
                    <StatusBadge>{trigger.label}</StatusBadge>
                    <div>
                      {data.aggregations[0] === 0 ? t('Events') : t('Users')}{' '}
                      {trigger.thresholdType === 0 ? t('above') : t('below')}{' '}
                      {trigger.alertThreshold}/{data.timeWindow}min
                    </div>
                  </Trigger>
                  <div>
                    {trigger.actions &&
                      trigger.actions.map((action, j) => (
                        <div key={j}>{action.desc}</div>
                      ))}
                  </div>
                </TriggerAndActions>
              );
            })}
        </div>
      </RuleItem>
    );
  }

  render() {
    const {data} = this.props;

    return isIssueAlert(data) ? this.renderIssueRule(data) : this.renderMetricRule(data);
  }
}

export default RuleRow;

const RuleItem = styled(PanelItem)`
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: 1fr 3fr 6fr;
  grid-auto-flow: column;
`;

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

const TriggerAndActions = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-flow: column;
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: ${space(1)};
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
  align-items: center;
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
