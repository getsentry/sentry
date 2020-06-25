import {browserHistory} from 'react-router';
import isEqual from 'lodash/isEqual';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Panel} from 'app/components/panels';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import AsyncView from 'app/views/asyncView';
import Feature from 'app/components/acl/feature';
import Pagination from 'app/components/pagination';
import SentryTypes from 'app/sentryTypes';
import parseLinkHeader from 'app/utils/parseLinkHeader';
import withOrganization from 'app/utils/withOrganization';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';

import EventsTable from './eventsTable';
import Chart from './chart';

const parseRowFromLinks = (links, numRows) => {
  links = parseLinkHeader(links);
  if (!links.previous.results) {
    return `1-${numRows}`;
  }
  const prevStart = Number(links.previous.cursor.split(':')[1]);
  const nextStart = Number(links.next.cursor.split(':')[1]);
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

  onRequestError() {
    Sentry.captureException(new Error('Unable to fetch "total event count"'));
  }

  renderError() {
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

class Events extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

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

  async handleRequestSuccess({stateKey, data, jqXHR}, ...args) {
    // When a direct hit is found, do not update state in `handleRequestSuccess`
    if (jqXHR.getResponseHeader('X-Sentry-Direct-Hit') === '1') {
      const {organization} = this.props;
      const event = data[0];

      const resp = await this.api.requestPromise(
        `/organizations/${organization.slug}/projects/`,
        {
          query: {
            query: `id:${event.projectID}`,
          },
        }
      );

      if (resp && resp.length > 0) {
        const project = resp[0];
        browserHistory.replace(
          `/organizations/${organization.slug}/projects/${project.slug}/events/${event.eventID}/`
        );
        return;
      }
    }

    super.handleRequestSuccess({stateKey, data, jqXHR}, ...args);
  }

  onRequestError(resp) {
    // Allow children to implement this
    if (resp && resp.responseJSON && resp.responseJSON.detail) {
      addErrorMessage(resp.responseJSON.detail);
    }
  }

  handleZoom = () => this.setState({zoomed: true});

  // Table is considered to be updated when table is in a
  // reloading state due to chart zoom, but reloading has been finished
  handleTableUpdateComplete = () => this.setState({zoomed: false});

  renderRowCounts() {
    const {events, eventsPageLinks} = this.state;
    if (!eventsPageLinks) {
      return null;
    }

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
    const parsedLinks =
      !loading && !error && eventsPageLinks ? parseLinkHeader(eventsPageLinks) : {};

    return (
      <React.Fragment>
        {error &&
          super.renderError(
            new Error('Unable to load all required endpoints'),
            false,
            true
          )}
        <Panel>
          <Chart
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

        {!loading && !reloading && !error && (
          <PaginationWrapper>
            <RowDisplay>
              {events.length ? t(`Results ${this.renderRowCounts()}`) : t('No Results')}
              {!!events.length && eventsPageLinks && (
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

            <PaginationNoMargin pageLinks={eventsPageLinks} />
          </PaginationWrapper>
        )}
      </React.Fragment>
    );
  }
}

const PaginationNoMargin = styled(Pagination)`
  margin: 0;
`;

const PaginationWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const RowDisplay = styled('div')`
  color: ${p => p.theme.gray400};
`;

export default withOrganization(Events);
export {Events, parseRowFromLinks};
