import React from 'react';
import DocumentTitle from 'react-document-title';

import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import Link from 'app/components/links/link';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import Pagination from 'app/components/pagination';
import {PageContent, PageHeader} from 'app/styles/organization';
import PageHeading from 'app/components/pageHeading';
import BetaTag from 'app/components/betaTag';

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
        <Link to={`/organizations/${orgId}/incidents/${incident.id}/`}>
          {incident.name}
        </Link>
      </PanelItem>
    );
  }

  renderEmpty() {
    return (
      <EmptyStateWarning small={true}>
        <p>{t("You don't have any incidents yet!")}</p>
      </EmptyStateWarning>
    );
  }

  renderBody() {
    const {incidentList, incidentListPageLinks} = this.state;

    return (
      <React.Fragment>
        <Panel>
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
    return (
      <DocumentTitle title={`Incidents - ${this.props.params.orgId} - Sentry`}>
        <PageContent>
          <PageHeader>
            <PageHeading withMargins>
              {t('Incidents')} <BetaTag />
            </PageHeading>
          </PageHeader>
          <OrganizationIncidentsBody {...this.props} />
        </PageContent>
      </DocumentTitle>
    );
  }
}

export default OrganizationIncidents;
