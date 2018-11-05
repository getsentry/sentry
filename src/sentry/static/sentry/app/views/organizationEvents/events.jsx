import React from 'react';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import {Panel} from 'app/components/panels';
import {getParams} from 'app/views/organizationEvents/utils';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import EventsChart from 'app/views/organizationEvents/eventsChart';
import EventsTable from 'app/views/organizationEvents/eventsTable';
import Pagination from 'app/components/pagination';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';
import PreviewFeature from 'app/components/previewFeature';

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
    let {statsPeriod, ...query} = location.query;

    return [
      [
        'events',
        `/organizations/${organization.slug}/events/`,
        {
          query: getParams({
            period: statsPeriod,
            ...query,
          }),
        },
      ],
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
        <Flex align="center" justify="space-between" mb={2}>
          <HeaderTitle>{t('Events')}</HeaderTitle>
          {this.renderSearchInput({})}
        </Flex>

        <PreviewFeature type="info" />

        <Panel>
          <EventsChart organization={organization} />
        </Panel>

        <EventsTable loading={loading} events={events} organization={organization} />

        <Pagination pageLinks={eventsPageLinks} />
      </React.Fragment>
    );
  }
}

const HeaderTitle = styled('h4')`
  margin: 0;
`;

export default withOrganization(OrganizationEvents);
export {OrganizationEvents};
