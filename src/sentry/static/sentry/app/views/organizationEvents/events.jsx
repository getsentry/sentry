import {Flex} from 'grid-emotion';
import {isEqual} from 'lodash';
import React from 'react';
import styled from 'react-emotion';

import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Pagination from 'app/components/pagination';
import PreviewFeature from 'app/components/previewFeature';
import SearchBar from 'app/components/searchBar';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';

import {getParams} from './utils/getParams';
import EventsChart from './eventsChart';
import EventsTable from './eventsTable';

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

  shouldComponentUpdate(nextProps, nextState) {
    if (this.state !== nextState) {
      return true;
    }

    const isDiff = ['path', 'search'].find(
      key => !isEqual(this.props.location[key], nextProps.location[key])
    );

    if (isDiff) {
      return true;
    }

    return false;
  }

  shouldReload = true;

  getEndpoints() {
    const {organization, location} = this.props;
    let {statsPeriod, ...query} = location.query;

    return [
      [
        'events',
        `/organizations/${organization.slug}/events/`,
        {
          query: getParams({
            statsPeriod,
            ...query,
          }),
        },
      ],
    ];
  }

  getTitle() {
    return `Events - ${this.props.organization.slug}`;
  }

  handleSearch = query => {
    let {router, location} = this.props;
    router.push({
      pathname: location.pathname,
      query: {
        ...(location.query || {}),
        query,
      },
    });
  };

  renderBody() {
    const {organization, location} = this.props;
    const {reloading, events, eventsPageLinks} = this.state;

    return (
      <React.Fragment>
        <Flex align="center" justify="space-between" mb={2}>
          <HeaderTitle>{t('Events')}</HeaderTitle>
          <StyledSearchBar
            query={location.query && location.query.query}
            placeholder={t('Search for events, users, tags, and everything else.')}
            onSearch={this.handleSearch}
          />
        </Flex>

        <PreviewFeature type="info" />

        <Panel>
          <EventsChart organization={organization} />
        </Panel>

        <EventsTable reloading={reloading} events={events} organization={organization} />

        <Pagination pageLinks={eventsPageLinks} />
      </React.Fragment>
    );
  }
}

const HeaderTitle = styled('h4')`
  flex: 1;
  margin: 0;
`;

const StyledSearchBar = styled(SearchBar)`
  flex: 1;
`;

export default withOrganization(OrganizationEvents);
export {OrganizationEvents};
