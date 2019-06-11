import {omit} from 'lodash';
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
import PageHeading from 'app/components/pageHeading';
import Pagination from 'app/components/pagination';
import getDynamicText from 'app/utils/getDynamicText';
import space from 'app/styles/space';

import Status from '../status';

const DEFAULT_QUERY_STATUS = '';

class OrganizationIncidentsList extends AsyncComponent {
  getEndpoints() {
    const {params, location} = this.props;
    return [
      [
        'incidentList',
        `/organizations/${params.orgId}/incidents/`,
        {
          query: location.query,
        },
      ],
    ];
  }

  renderListItem(incident) {
    const {orgId} = this.props.params;
    const started = moment(incident.dateStarted);
    const duration = moment
      .duration(moment(incident.dateClosed || new Date()).diff(started))
      .as('seconds');

    return (
      <PanelItem key={incident.id}>
        <TableLayout>
          <Link to={`/organizations/${orgId}/incidents/${incident.identifier}/`}>
            {incident.title}
          </Link>
          <Status incident={incident} />
          <div>{started.format('LL')}</div>
          <div>
            <Duration seconds={getDynamicText({value: duration, fixed: 1200})} />
          </div>

          <div>
            <Count value={incident.uniqueUsers} />
          </div>
          <div>
            <Count value={incident.totalEvents} />
          </div>
        </TableLayout>
      </PanelItem>
    );
  }

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t("You don't have any incidents yet")}</p>
      </EmptyStateWarning>
    );
  }

  renderBody() {
    const {incidentList, incidentListPageLinks} = this.state;

    return (
      <React.Fragment>
        <Panel>
          <PanelHeader>
            <TableLayout>
              <div>{t('Incident')}</div>
              <div>{t('Status')}</div>
              <div>{t('Started')}</div>
              <div>{t('Duration')}</div>
              <div>{t('Users affected')}</div>
              <div>{t('Total events')}</div>
            </TableLayout>
          </PanelHeader>
          <PanelBody>
            {incidentList.length === 0 && this.renderEmpty()}
            {incidentList.map(incident => this.renderListItem(incident))}
          </PanelBody>
        </Panel>
        <Pagination pageLinks={incidentListPageLinks} />
      </React.Fragment>
    );
  }
}

class OrganizationIncidentsListContainer extends React.Component {
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
            <PageHeading withMargins>
              {t('Incidents')} <BetaTag />
            </PageHeading>

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
          </PageHeader>

          <AlertLink
            priority="warning"
            to={`/organizations/${orgId}/issues/`}
            icon="icon-circle-info"
          >
            {tct(
              'To create a new incident, select one or more issues from the Issues view. Then, click the [create:Create Incident] button.',
              {create: <em />}
            )}
          </AlertLink>

          <OrganizationIncidentsList {...this.props} />
        </PageContent>
      </DocumentTitle>
    );
  }
}

const TableLayout = styled('div')`
  display: grid;
  grid-template-columns: 4fr 1fr 1fr 1fr 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
`;

export default OrganizationIncidentsListContainer;
