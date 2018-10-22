import React from 'react';

import {Panel, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import EventsChart from 'app/views/organizationEvents/eventsChart';
import EventsTable from 'app/views/organizationEvents/eventsTable';
import Pagination from 'app/components/pagination';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';

class OrganizationEvents extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  constructor(props) {
    super(props);
    this.projectsMap = new Map(
      props.organization.projects.map(project => [project.id, project])
    );
  }

  getEndpoints() {
    const {organization, location} = this.props;

    return [
      ['events', `/organizations/${organization.slug}/events/`, {query: location.query}],
    ];
  }

  getTitle() {
    return `${this.props.organization.slug} Events`;
  }

  renderBody() {
    const {organization} = this.props;
    const {loading, events, eventsPageLinks} = this.state;

    return (
      <React.Fragment>
        <Panel>
          <PanelHeader hasButtons>
            {t('Events')}
            {this.renderSearchInput({})}
          </PanelHeader>

          <EventsChart organization={organization} />

          <EventsTable loading={loading} events={events} organization={organization} />
        </Panel>

        <Pagination pageLinks={eventsPageLinks} />
      </React.Fragment>
    );
  }
}

export default withOrganization(OrganizationEvents);
export {OrganizationEvents};
