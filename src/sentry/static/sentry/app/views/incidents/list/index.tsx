import {Location} from 'history';
import {Params} from 'react-router/lib/Router';
import omit from 'lodash/omit';
import DocumentTitle from 'react-document-title';
import React from 'react';
import moment from 'moment';
import styled from 'react-emotion';

import {PageContent, PageHeader} from 'app/styles/organization';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t, tct} from 'app/locale';
import AlertLink from 'app/components/alertLink';
import AsyncComponent from 'app/components/asyncComponent';
import BetaTag from 'app/components/betaTag';
import Button from 'app/components/button';
import Count from 'app/components/count';
import Duration from 'app/components/duration';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import PageHeading from 'app/components/pageHeading';
import Pagination from 'app/components/pagination';
import getDynamicText from 'app/utils/getDynamicText';
import space from 'app/styles/space';

import Status from '../status';
import SparkLine from './sparkLine';
import {Incident} from '../types';

const DEFAULT_QUERY_STATUS = '';

type Props = {
  params: Params;
  location: Location;
};

type State = {
  incidentList: Incident[];
};

class IncidentsList extends AsyncComponent<Props, State & AsyncComponent['state']> {
  getEndpoints(): [string, string, any][] {
    const {params, location} = this.props;
    return [
      [
        'incidentList',
        `/organizations/${params && params.orgId}/incidents/`,
        {
          query: location && location.query,
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
            <Link to={`/organizations/${orgId}/incidents/${incident.identifier}/`}>
              {incident.title}
            </Link>
            <SparkLine incident={incident} />
          </TitleAndSparkLine>
          <Status incident={incident} />
          <div>
            {started.format('LL')}
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
        <p>{t("You don't have any Incidents yet")}</p>
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
              <div>{t('Incident')}</div>
              <div>{t('Status')}</div>
              <div>{t('Started')}</div>
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
  render() {
    const {params, location} = this.props;
    const {pathname, query} = location;
    const {orgId} = params;

    const openIncidentsQuery = {...query, status: 'open'};
    const closedIncidentsQuery = {...query, status: 'closed'};
    const allIncidentsQuery = omit(query, 'status');

    const status = query.status === undefined ? DEFAULT_QUERY_STATUS : query.status;

    return (
      <DocumentTitle title={`Incidents - ${orgId} - Sentry`}>
        <PageContent>
          <PageHeader>
            <PageHeading>
              {t('Incidents')} <BetaTag />
            </PageHeading>

            <Actions>
              <div className="btn-group">
                <Button
                  to={{pathname, query: allIncidentsQuery}}
                  size="small"
                  className={'btn' + (status === '' ? ' active' : '')}
                >
                  {t('All Incidents')}
                </Button>
                <Button
                  to={{pathname, query: openIncidentsQuery}}
                  size="small"
                  className={'btn' + (status === 'open' ? ' active' : '')}
                >
                  {t('Open')}
                </Button>
                <Button
                  to={{pathname, query: closedIncidentsQuery}}
                  size="small"
                  className={'btn' + (status === 'closed' ? ' active' : '')}
                >
                  {t('Closed')}
                </Button>
              </div>
            </Actions>
          </PageHeader>

          <AlertLink
            priority="info"
            to={`/organizations/${orgId}/issues/`}
            icon="icon-circle-info"
          >
            {tct(
              'To create a new Incident, select one or more issues from the Issues view. Then, click the [create:Create Incident] button.',
              {create: <em />}
            )}
          </AlertLink>

          <IncidentsList {...this.props} />
        </PageContent>
      </DocumentTitle>
    );
  }
}

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
`;

const IncidentPanelItem = styled(PanelItem)`
  padding: ${space(1)} ${space(2)};
`;

const NumericColumn = styled('div')`
  text-align: right;
`;

export default IncidentsListContainer;
