import * as Sentry from '@sentry/browser';
import {Flex} from 'grid-emotion';
import {isEqual} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import AsyncView from 'app/views/asyncView';
import Feature from 'app/components/acl/feature';
import Pagination from 'app/components/pagination';
import SentryTypes from 'app/sentryTypes';
import utils from 'app/utils';
import withOrganization from 'app/utils/withOrganization';

import {getParams} from './utils/getParams';
import EventsChart from './eventsChart';
import EventsTable from './eventsTable';

const parseRowFromLinks = (links, numRows) => {
  links = utils.parseLinkHeader(links);
  if (!links.previous.results) {
    return `1-${numRows}`;
  }
  const prevStart = links.previous.cursor.split(':')[1];
  const nextStart = links.next.cursor.split(':')[1];
  const currentStart = (prevStart + nextStart) / 2 + 1;
  return `${currentStart}-${currentStart + numRows - 1}`;
};

class TotalEventCount extends AsyncComponent {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    location: PropTypes.object.isRequired,
    isAllResults: PropTypes.bool.isRequired,
    numRows: PropTypes.number.isRequired,
  };

  getEndpoints() {
    const {organization, location} = this.props;
    const {statsPeriod, ...query} = location.query;

    return [
      [
        'eventsMeta',
        `/organizations/${organization.slug}/events-meta/`,
        {
          query: getParams({
            statsPeriod,
            ...query,
          }),
        },
      ],
    ];
  }

  onRequestError(error) {
    Sentry.captureException(new Error('Unable to fetch "total event count"'));
  }

  renderError(error, disableLog = false, disableReport = false) {
    // Don't show an error message, handle it in `onRequestError`
    return null;
  }

  renderBody() {
    const {eventsMeta} = this.state;
    const {isAllResults, numRows} = this.props;
    const count = isAllResults ? numRows : eventsMeta.count;
    return t(` of ${count.toLocaleString()}${isAllResults ? '' : ' (estimated)'}`);
  }
}

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
    // Always update if state changes
    if (this.state !== nextState) {
      return true;
    }

    const isDiff = ['path', 'search'].find(
      key => !isEqual(this.props.location[key], nextProps.location[key])
    );

    // Always update if query parameters change
    if (isDiff) {
      return true;
    }

    return false;
  }

  shouldReload = true;

  getEndpoints() {
    const {organization, location} = this.props;
    const {statsPeriod, ...query} = location.query;

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

  handleZoom = () => this.setState({zoomed: true});

  // Table is considered to be updated when table is in a
  // reloading state due to chart zoom, but reloading has been finished
  handleTableUpdateComplete = () => this.setState({zoomed: false});

  renderRowCounts() {
    const {events, eventsPageLinks} = this.state;
    return parseRowFromLinks(eventsPageLinks, events.length);
  }

  renderError() {
    return this.renderBody();
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {organization, location, router} = this.props;
    const {error, loading, reloading, events, eventsPageLinks} = this.state;
    const parsedLinks = !loading && !error ? utils.parseLinkHeader(eventsPageLinks) : {};

    return (
      <React.Fragment>
        {error &&
          super.renderError(
            new Error('Unable to load all required endpoints'),
            false,
            true
          )}
        <Panel>
          <EventsChart
            router={router}
            query={location.query.query}
            organization={organization}
            onZoom={this.handleZoom}
          />
        </Panel>

        <EventsTable
          loading={!reloading && loading}
          reloading={reloading}
          zoomChanged={this.state.zoomed}
          events={events}
          organization={organization}
          onUpdateComplete={this.handleTableUpdateComplete}
        />

        {!loading &&
          !reloading &&
          !error && (
            <Flex align="center" justify="space-between">
              <RowDisplay>
                {events.length ? t(`Results ${this.renderRowCounts()}`) : t('No Results')}
                {!!events.length && (
                  <Feature features={['internal-catchall']}>
                    <TotalEventCount
                      organization={organization}
                      location={location}
                      isAllResults={
                        !parsedLinks.previous.results && !parsedLinks.next.results
                      }
                      numRows={events.length}
                    />
                  </Feature>
                )}
              </RowDisplay>
              <Pagination pageLinks={eventsPageLinks} className="" />
            </Flex>
          )}
      </React.Fragment>
    );
  }
}

const RowDisplay = styled('div')`
  color: ${p => p.theme.gray6};
`;

export default withOrganization(OrganizationEvents);
export {OrganizationEvents, parseRowFromLinks};
