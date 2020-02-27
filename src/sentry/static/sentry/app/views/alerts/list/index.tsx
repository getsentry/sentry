import {RouteComponentProps} from 'react-router/lib/Router';
import DocumentTitle from 'react-document-title';
import omit from 'lodash/omit';
import React from 'react';
import moment from 'moment';
import styled from '@emotion/styled';

import {PageContent, PageHeader} from 'app/styles/organization';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {navigateTo} from 'app/actionCreators/navigation';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import BetaTag from 'app/components/betaTag';
import Button from 'app/components/button';
import Count from 'app/components/count';
import Duration from 'app/components/duration';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import ExternalLink from 'app/components/links/externalLink';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import PageHeading from 'app/components/pageHeading';
import Pagination from 'app/components/pagination';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import getDynamicText from 'app/utils/getDynamicText';
import space from 'app/styles/space';

import {Incident} from '../types';
import SparkLine from './sparkLine';
import Status from '../status';

const DEFAULT_QUERY_STATUS = 'open';

type Props = RouteComponentProps<{orgId: string}, {}>;

type State = {
  incidentList: Incident[];
};

function getQueryStatus(status: any) {
  return ['open', 'closed', 'all'].includes(status) ? status : DEFAULT_QUERY_STATUS;
}
class IncidentsList extends AsyncComponent<Props, State & AsyncComponent['state']> {
  getEndpoints(): [string, string, any][] {
    const {params, location} = this.props;
    const {query} = location;
    const status = getQueryStatus(query.status);

    return [
      [
        'incidentList',
        `/organizations/${params && params.orgId}/incidents/`,
        {
          query: {...query, status},
        },
      ],
    ];
  }

  renderListItem(incident: Incident) {
    const {orgId} = this.props.params;
    const started = moment(incident.dateStarted);
    const duration = moment
      .duration(moment(incident.dateClosed || new Date()).diff(started))
      .as('seconds');

    return (
      <IncidentPanelItem key={incident.id}>
        <TableLayout>
          <TitleAndSparkLine>
            <TitleLink to={`/organizations/${orgId}/alerts/${incident.identifier}/`}>
              {incident.title}
            </TitleLink>
            <SparkLine incident={incident} />
          </TitleAndSparkLine>
          <Status incident={incident} />
          <div>
            {started.format('L')}
            <LightDuration seconds={getDynamicText({value: duration, fixed: 1200})} />
          </div>
          <NumericColumn>
            <Count value={incident.uniqueUsers} />
          </NumericColumn>
          <NumericColumn>
            <Count value={incident.totalEvents} />
          </NumericColumn>
        </TableLayout>
      </IncidentPanelItem>
    );
  }

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t("You don't have any Alerts yet")}</p>
      </EmptyStateWarning>
    );
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {loading, incidentList, incidentListPageLinks} = this.state;

    return (
      <React.Fragment>
        <Panel>
          <PanelHeader>
            <TableLayout>
              <TitleAndSparkLine>
                <div>{t('Alert')}</div>
                <div>{t('Trend')}</div>
              </TitleAndSparkLine>
              <div>{t('Status')}</div>
              <div>{t('Start time (duration)')}</div>
              <NumericColumn>{t('Users affected')}</NumericColumn>
              <NumericColumn>{t('Total events')}</NumericColumn>
            </TableLayout>
          </PanelHeader>

          <PanelBody>
            {loading && <LoadingIndicator />}
            {!loading && (
              <React.Fragment>
                {incidentList.length === 0 && this.renderEmpty()}
                {incidentList.map(incident => this.renderListItem(incident))}
              </React.Fragment>
            )}
          </PanelBody>
        </Panel>
        <Pagination pageLinks={incidentListPageLinks} />
      </React.Fragment>
    );
  }
}

class IncidentsListContainer extends React.Component<Props> {
  /**
   * Incidents list is currently at the organization level, but the link needs to
   * go down to a specific project scope.
   */
  handleNavigateToSettings = (e: React.MouseEvent) => {
    const {router, params} = this.props;
    e.preventDefault();

    navigateTo(`/settings/${params.orgId}/projects/:projectId/alerts/`, router);
  };

  render() {
    const {params, location} = this.props;
    const {pathname, query} = location;
    const {orgId} = params;

    const openIncidentsQuery = omit({...query, status: 'open'}, 'cursor');
    const closedIncidentsQuery = omit({...query, status: 'closed'}, 'cursor');
    const allIncidentsQuery = omit({...query, status: 'all'}, 'cursor');

    const status = getQueryStatus(query.status);
    return (
      <DocumentTitle title={`Alerts- ${orgId} - Sentry`}>
        <PageContent>
          <PageHeader>
            <StyledPageHeading>
              {t('Alerts')}{' '}
              <BetaTag
                title={t(
                  'This feature may change in the future and currently only shows metric alerts'
                )}
              />
              <FeedbackLink href="mailto:alerting-feedback@sentry.io">
                {t('Send feedback')}
              </FeedbackLink>
            </StyledPageHeading>

            <Actions>
              <Button
                onClick={this.handleNavigateToSettings}
                href="#"
                size="small"
                icon="icon-settings"
              >
                {t('Settings')}
              </Button>

              <div className="btn-group">
                <Button
                  to={{pathname, query: openIncidentsQuery}}
                  size="small"
                  className={'btn' + (status === 'open' ? ' active' : '')}
                >
                  {t('Active')}
                </Button>
                <Button
                  to={{pathname, query: closedIncidentsQuery}}
                  size="small"
                  className={'btn' + (status === 'closed' ? ' active' : '')}
                >
                  {t('Resolved')}
                </Button>
                <Button
                  to={{pathname, query: allIncidentsQuery}}
                  size="small"
                  className={'btn' + (status === 'all' ? ' active' : '')}
                >
                  {t('All')}
                </Button>
              </div>
            </Actions>
          </PageHeader>

          <IncidentsList {...this.props} />
        </PageContent>
      </DocumentTitle>
    );
  }
}

const StyledPageHeading = styled(PageHeading)`
  display: flex;
  align-items: center;
`;

const FeedbackLink = styled(ExternalLink)`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-left: ${space(1)};
`;

const Actions = styled('div')`
  display: grid;
  align-items: center;
  grid-gap: ${space(1)};
  grid-auto-flow: column;
`;

const TableLayout = styled('div')`
  display: grid;
  grid-template-columns: 4fr 1fr 2fr 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
`;

const LightDuration = styled(Duration)`
  color: ${p => p.theme.gray1};
  font-size: 0.9em;
  margin-left: ${space(1)};
`;

const TitleAndSparkLine = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-right: ${space(2)};
  overflow: hidden;
`;

const TitleLink = styled(Link)`
  ${overflowEllipsis}
`;

const IncidentPanelItem = styled(PanelItem)`
  padding: ${space(1)} ${space(2)};
`;

const NumericColumn = styled('div')`
  text-align: right;
`;

export default IncidentsListContainer;
