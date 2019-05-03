import React from 'react';
import DocumentTitle from 'react-document-title';
import styled from 'react-emotion';
import {omit} from 'lodash';

import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import Link from 'app/components/links/link';
import Button from 'app/components/button';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import Pagination from 'app/components/pagination';
import {PageContent, PageHeader} from 'app/styles/organization';
import PageHeading from 'app/components/pageHeading';
import BetaTag from 'app/components/betaTag';
import space from 'app/styles/space';
import {getStatus} from '../utils';

const DEFAULT_QUERY_STATUS = 'unresolved';

class OrganizationIncidentsBody extends AsyncComponent {
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

    return (
      <PanelItem key={incident.id}>
        <TableLayout>
          <Link to={`/organizations/${orgId}/incidents/${incident.identifier}/`}>
            {incident.title}
          </Link>
          <div>{getStatus(incident.status)}</div>
          <div>{incident.duration}</div>
          <div>{incident.usersAffected}</div>
          <div>{incident.eventCount}</div>
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

class OrganizationIncidents extends React.Component {
  render() {
    const {pathname, query} = this.props.location;

    const unresolvedQuery = omit(query, 'status');
    const allIncidentsQuery = {...query, status: ''};

    const status = query.status === undefined ? DEFAULT_QUERY_STATUS : query.status;

    return (
      <DocumentTitle title={`Incidents - ${this.props.params.orgId} - Sentry`}>
        <PageContent>
          <PageHeader>
            <PageHeading withMargins>
              {t('Incidents')} <BetaTag />
            </PageHeading>

            <div className="btn-group">
              <Button
                to={{pathname, query: unresolvedQuery}}
                size="small"
                className={'btn' + (status === 'unresolved' ? ' active' : '')}
              >
                {t('Unresolved')}
              </Button>
              <Button
                to={{pathname, query: allIncidentsQuery}}
                size="small"
                className={'btn' + (status === '' ? ' active' : '')}
              >
                {t('All Issues')}
              </Button>
            </div>
          </PageHeader>
          <OrganizationIncidentsBody {...this.props} />
        </PageContent>
      </DocumentTitle>
    );
  }
}

const TableLayout = styled('div')`
  display: grid;
  grid-template-columns: 4fr 1fr 1fr 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
`;

export default OrganizationIncidents;
