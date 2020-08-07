import React from 'react';
import flatten from 'lodash/flatten';
import styled from '@emotion/styled';

import {IconCheckmark} from 'app/icons';
import {Organization} from 'app/types';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import LoadingIndicator from 'app/components/loadingIndicator';
import {PanelHeader, PanelBody} from 'app/components/panels';
import Projects from 'app/utils/projects';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import AlertListRow from 'app/views/alerts/list/row';
import {Incident} from 'app/views/alerts/types';

import Card from './index';

const DEFAULT_QUERY_STATUS = 'open';

function getQueryStatus(status: any): 'open' | 'closed' {
  return ['open', 'closed'].includes(status) ? status : DEFAULT_QUERY_STATUS;
}

type Props = {
  organization: Organization;
  status: 'open' | 'closed';
} & Card['props'] &
  AsyncComponent['props'];

type State = {
  incidentList: Incident[];
  /**
   * Is there at least one alert rule configured for the currently selected
   * projects?
   */
  hasAlertRule?: boolean;
  /**
   * User has not yet seen the 'alert_stream' welcome prompt for this
   * organization.
   */
  firstVisitShown?: boolean;
};

class CardAlerts extends AsyncComponent<Props, State & AsyncComponent['state']> {
  getEndpoints(): [string, string, any][] {
    const {organization, status} = this.props;
    const currStatus = getQueryStatus(status);

    return [
      [
        'incidentList',
        `/organizations/${organization.slug}/incidents/`,
        {query: {status: currStatus}},
      ],
    ];
  }

  async onLoadAllEndpointsSuccess() {
    const {incidentList} = this.state;

    if (incidentList.length !== 0) {
      this.setState({hasAlertRule: true, firstVisitShown: false});
      return;
    }

    this.setState({loading: true});

    // Check if they have rules or not, to know which empty state message to
    // display
    const {organization} = this.props;

    const alertRules = await this.api.requestPromise(
      `/organizations/${organization.slug}/alert-rules/`,
      {
        method: 'GET',
        query: {},
      }
    );
    const hasAlertRule = alertRules.length > 0;

    // We've already configured alert rules, no need to check if we should show
    // the "first time welcome" prompt
    if (hasAlertRule) {
      this.setState({hasAlertRule, firstVisitShown: false, loading: false});
      return;
    }

    // Check if they have already seen the prompt for the alert stream
    const prompt = await this.api.requestPromise('/promptsactivity/', {
      query: {
        organization_id: organization.id,
        feature: 'alert_stream',
      },
    });

    const firstVisitShown = !prompt?.data?.dismissed_ts;
    this.setState({hasAlertRule, firstVisitShown, loading: false});
  }

  tryRenderEmpty() {
    const {hasAlertRule, incidentList} = this.state;
    const status = getQueryStatus(this.props.status);

    if (incidentList.length > 0) {
      return null;
    }

    return (
      <EmptyMessage
        size="medium"
        icon={<IconCheckmark isCircled size="48" />}
        title={
          !hasAlertRule
            ? t('No metric alert rules exist for these projects.')
            : status === 'open'
            ? t(
                'Everything’s a-okay. There are no unresolved metric alerts in these projects.'
              )
            : t('There are no resolved metric alerts in these projects.')
        }
      />
    );
  }

  renderLoading() {
    return this.renderBody();
  }

  renderList() {
    const {status} = this.props;
    const {loading, incidentList, hasAlertRule} = this.state;

    const orgId = this.props.organization.slug;
    const allProjectsFromIncidents = new Set(
      flatten(incidentList?.map(({projects}) => projects))
    );
    const checkingForAlertRules =
      incidentList && incidentList.length === 0 && hasAlertRule === undefined
        ? true
        : false;
    const showLoadingIndicator = loading || checkingForAlertRules;

    return (
      <React.Fragment>
        {!loading && (
          <StyledPanelHeader>
            <TableLayout status={status}>
              <PaddedTitleAndSparkLine status={status}>
                <div>{t('Alert')}</div>
                {status === 'open' && <div>{t('Graph')}</div>}
              </PaddedTitleAndSparkLine>
              <div>{t('Project')}</div>
              <div>{t('Triggered')}</div>
              {status === 'closed' && <div>{t('Duration')}</div>}
              {status === 'closed' && <div>{t('Resolved')}</div>}
            </TableLayout>
          </StyledPanelHeader>
        )}
        {showLoadingIndicator ? (
          <LoadingIndicator />
        ) : (
          this.tryRenderEmpty() ?? (
            <PanelBody>
              <Projects orgId={orgId} slugs={Array.from(allProjectsFromIncidents)}>
                {({initiallyLoaded, projects}) =>
                  incidentList.map(incident => (
                    <AlertListRow
                      key={incident.id}
                      projectsLoaded={initiallyLoaded}
                      projects={projects}
                      incident={incident}
                      orgId={orgId}
                      filteredStatus={status}
                    />
                  ))
                }
              </Projects>
            </PanelBody>
          )
        )}
      </React.Fragment>
    );
  }

  renderBody() {
    return (
      <Card {...this.props} columnSpan={1} isRemovable={false}>
        {this.renderList()}
      </Card>
    );
  }
}

const TableLayout = styled('div')<{status: 'open' | 'closed'}>`
  display: grid;
  grid-template-columns: ${p =>
    p.status === 'open' ? '4fr 1fr 2fr' : '3fr 2fr 2fr 1fr 2fr'};
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
`;

const TitleAndSparkLine = styled('div')<{status: 'open' | 'closed'}>`
  display: ${p => (p.status === 'open' ? 'grid' : 'flex')};
  grid-gap: ${space(1)};
  grid-template-columns: auto 120px;
  align-items: center;
  padding-right: ${space(2)};
  overflow: hidden;
`;

const PaddedTitleAndSparkLine = styled(TitleAndSparkLine)`
  padding-left: ${space(2)};
`;

const StyledPanelHeader = styled(PanelHeader)`
  /* Match table row padding for the grid to align */
  padding: ${space(1.5)} ${space(2)} ${space(1.5)} 0;
`;

export {TableLayout, TitleAndSparkLine};
export default withOrganization(CardAlerts);
