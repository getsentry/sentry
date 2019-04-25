import React from 'react';
import {withRouter} from 'react-router';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import Link from 'app/components/link';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import Pagination from 'app/components/pagination';

class OrganizationIncidents extends AsyncView {
  getTitle() {
    return `Incidents - ${this.props.params.orgId}`;
  }

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

export default withRouter(OrganizationIncidents);
