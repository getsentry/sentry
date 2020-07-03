import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';
import styled from '@emotion/styled';

import {IconAdd, IconSettings} from 'app/icons';
import {IssueAlertRule} from 'app/types/alerts';
import {Organization} from 'app/types';
import {PanelTable} from 'app/components/panels';
import {SavedIncidentRule} from 'app/views/settings/incidentRules/types';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import OnboardingHovercard from 'app/views/settings/projectAlerts/onboardingHovercard';
import Pagination from 'app/components/pagination';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import RuleRow from 'app/views/settings/projectAlerts/ruleRow';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import Tooltip from 'app/components/tooltip';
import routeTitle from 'app/utils/routeTitle';
import space from 'app/styles/space';

type Props = {
  canEditRule: boolean;
  organization: Organization;
} & RouteComponentProps<
  {
    orgId: string;
    projectId: string;
  },
  {}
>;

type State = {
  rules: Array<
    ({type: 'alert_rule'} & IssueAlertRule) | ({type: 'rule'} & SavedIncidentRule)
  >;
} & AsyncView['state'];

class ProjectAlertRules extends AsyncView<Props, State> {
  getEndpoints(): [string, string][] {
    const {orgId, projectId} = this.props.params;
    return [['rules', `/projects/${orgId}/${projectId}/combined-rules/`]];
  }

  getTitle() {
    const {projectId} = this.props.params;
    return routeTitle(t('Alert Rules'), projectId);
  }

  renderResults() {
    const {canEditRule, params} = this.props;
    const {orgId, projectId} = params;

    return (
      <React.Fragment>
        {this.state.rules.map(rule => (
          <RuleRow
            type={rule.type === 'alert_rule' ? 'issue' : 'metric'}
            api={this.api}
            key={`${rule.type}-${rule.id}`}
            data={rule}
            orgId={orgId}
            projectId={projectId}
            params={this.props.params}
            location={this.props.location}
            routes={this.props.routes}
            canEdit={canEditRule}
          />
        ))}
      </React.Fragment>
    );
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {canEditRule, location, organization, params} = this.props;
    const {orgId, projectId} = params;
    const {loading, rules, rulesPageLinks} = this.state;

    const basePath = `/settings/${orgId}/projects/${projectId}/alerts/`;

    return (
      <React.Fragment>
        <SettingsPageHeader
          title={t('Alert Rules')}
          action={
            <HeaderActions>
              <Button to={`${basePath}settings/`} size="small" icon={<IconSettings />}>
                {t('Settings')}
              </Button>
              <OnboardingHovercard organization={organization} location={location}>
                <Tooltip
                  disabled={canEditRule}
                  title={t('You do not have permission to edit alert rules.')}
                >
                  <Button
                    to={`${basePath}new/`}
                    disabled={!canEditRule}
                    priority="primary"
                    size="small"
                    icon={<IconAdd size="xs" isCircled />}
                  >
                    {t('New Alert Rule')}
                  </Button>
                </Tooltip>
              </OnboardingHovercard>
            </HeaderActions>
          }
        />
        <PermissionAlert />

        <ScrollWrapper>
          <StyledPanelTable
            isLoading={loading}
            isEmpty={!loading && !rules.length}
            emptyMessage={t('There are no alerts configured for this project.')}
            headers={[
              <div key="type">{t('Type')}</div>,
              <div key="name">{t('Name')}</div>,
              <div key="conditions">{t('Conditions/Triggers')}</div>,
              <div key="actions">{t('Action(s)')}</div>,
            ]}
          >
            {() => this.renderResults()}
          </StyledPanelTable>
        </ScrollWrapper>

        <Pagination pageLinks={rulesPageLinks} />
      </React.Fragment>
    );
  }
}

export default ProjectAlertRules;

const ScrollWrapper = styled('div')`
  width: 100%;
  overflow-x: auto;
`;

/**
 * TODO(billy): Not sure if this should be default for PanelTable or not
 */
const StyledPanelTable = styled(PanelTable)`
  width: fit-content;
  min-width: 100%;
`;

const HeaderActions = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
`;
