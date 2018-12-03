import {Flex} from 'grid-emotion';
import {isEqual} from 'lodash';
import React from 'react';
import styled from 'react-emotion';

import utils from 'app/utils';
import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Pagination from 'app/components/pagination';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';
import BetaTag from 'app/components/betaTag';

import {getParams} from './utils/getParams';
import EventsChart from './eventsChart';
import EventsTable from './eventsTable';
import SearchBar from './searchBar';

const parseRowFromLinks = (links, numRows) => {
  links = utils.parseLinkHeader(links);
  if (!links.previous.results) {
    return `1-${numRows}`;
  }
  let prevStart = links.previous.cursor.split(':')[1];
  let nextStart = links.next.cursor.split(':')[1];
  let currentStart = (prevStart + nextStart) / 2 + 1;
  return `${currentStart}-${currentStart + numRows - 1}`;
};

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

  renderRowCounts() {
    const {events, eventsPageLinks} = this.state;
    return parseRowFromLinks(eventsPageLinks, events.length);
  }

  renderBody() {
    const {organization, location} = this.props;
    const {reloading, events, eventsPageLinks} = this.state;

    return (
      <React.Fragment>
        <Flex align="center" justify="space-between" mb={2}>
          <HeaderTitle>
            {t('Events')} <BetaTag />
          </HeaderTitle>
          <StyledSearchBar
            query={(location.query && location.query.query) || ''}
            onSearch={this.handleSearch}
            organization={organization}
          />
        </Flex>

        <Panel>
          <EventsChart organization={organization} />
        </Panel>

        <EventsTable reloading={reloading} events={events} organization={organization} />

        <Flex align="center" justify="space-between">
          <RowDisplay>
            {events.length ? t(`Results ${this.renderRowCounts()}`) : t('No Results')}
          </RowDisplay>
          <Pagination pageLinks={eventsPageLinks} className="" />
        </Flex>
      </React.Fragment>
    );
  }
}

const HeaderTitle = styled('h4')`
  flex: 1;
  font-size: ${p => p.theme.headerFontSize};
  line-height: ${p => p.theme.headerFontSize};
  font-weight: normal;
  color: ${p => p.theme.gray4};
  margin: 0;
`;

const StyledSearchBar = styled(SearchBar)`
  flex: 1;
`;

const RowDisplay = styled('div')`
  color: ${p => p.theme.gray6};
`;

export default withOrganization(OrganizationEvents);
export {OrganizationEvents, parseRowFromLinks};
