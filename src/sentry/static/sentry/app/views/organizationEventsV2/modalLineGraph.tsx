import React from 'react';
import PropTypes from 'prop-types';
import {browserHistory} from 'react-router';
import {omit} from 'lodash';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import {getInterval, useShortInterval} from 'app/components/charts/utils';
import {
  getFormattedDate,
  getUtcDateString,
  intervalToMilliseconds,
} from 'app/utils/dates';
import EventsRequest from 'app/views/events/utils/eventsRequest';
import LineChart from 'app/components/charts/lineChart';
import MarkLine from 'app/components/charts/components/markLine';
import {Panel} from 'app/components/panels';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import theme from 'app/utils/theme';
import {Event, Organization, EventView} from 'app/types';

import {MODAL_QUERY_KEYS, PIN_ICON} from './data';
import {getQueryString} from './utils';
import {ReactRouterLocation} from 'app/types/reactRouter';

/**
 * Generate the data to display a vertical line for the current
 * event on the graph.
 */
const getCurrentEventMarker = (currentEvent: Event) => {
  const title = t('Current Event');
  const eventTime = +new Date(
    currentEvent.dateCreated || currentEvent.endTimestamp * 1000
  );

  return {
    type: 'line',
    data: [],
    markLine: MarkLine({
      symbol: [PIN_ICON, 'none'],
      symbolSize: [15, 30],
      lineStyle: {
        normal: {
          color: theme.red,
          type: 'dotted',
        },
      },
      tooltip: {
        formatter: () => {
          return `<div>${getFormattedDate(eventTime, 'MMM D, YYYY LT')}</div>`;
        },
      },
      label: {
        show: false,
      },
      data: [
        {
          xAxis: eventTime,
          name: title,
        },
      ],
    }),
  };
};

/**
 * Handle click events on line markers
 *
 * When a user clicks on a marker we want to update the modal
 * to display an event from that time slice. While each graph slice
 * could contain thousands of events, we use the /latest endpoint
 * to pick one.
 */
const handleClick = async function(
  series,
  {api, organization, queryString, interval, selection, location}
) {
  // Get the timestamp that was clicked.
  const value = series.value[0];

  // Get events that match the clicked timestamp
  // taking into account the group and current environment & query
  const query = {
    environment: selection.environments,
    query: queryString,
    start: getUtcDateString(value),
    end: getUtcDateString(value + intervalToMilliseconds(interval)),
  };

  const url = `/organizations/${organization.slug}/events/latest/`;
  let response;
  try {
    response = await api.requestPromise(url, {
      method: 'GET',
      query,
    });
  } catch (e) {
    // Do nothing, user could have clicked on a blank space.
    return;
  }

  browserHistory.push({
    pathname: location.pathname,
    query: {
      ...omit(location.query, MODAL_QUERY_KEYS),
      eventSlug: `${response.projectSlug}:${response.eventID}`,
    },
  });
};

type ModalLineGraphProps = {
  // TODO: fix this
  api: any;
  organization: Organization;
  location: ReactRouterLocation;
  currentEvent: Event;
  view: EventView;
};

/**
 * Render a graph of event volumes for the current group + event.
 */
const ModalLineGraph = (props: ModalLineGraphProps) => {
  const {api, organization, location, selection, currentEvent, view} = props;

  const isUtc = selection.datetime.utc;
  const dateFormat = 'lll';

  const interval = getInterval(selection.datetime, true);
  const hasShortInterval = useShortInterval(selection.datetime);

  const xAxisOptions = {
    type: 'time',
    axisLabel: {
      formatter: (value, index) => {
        const firstItem = index === 0;
        const format = hasShortInterval && !firstItem ? 'LT' : dateFormat;
        return getFormattedDate(value, format, {local: !isUtc});
      },
    },
  };

  const tooltip = {
    formatAxisLabel: value => {
      return getFormattedDate(value, 'lll', {local: !isUtc});
    },
  };

  // Generate a query string that finds events similar to our
  // current event based on the type of view being used.
  const eventConditions = {};
  if (view.id === 'transactions') {
    eventConditions.transaction = currentEvent.location;
  } else {
    eventConditions['issue.id'] = currentEvent.groupID;
  }
  const queryString = getQueryString(view, location, eventConditions);

  return (
    <Panel>
      <EventsRequest
        api={api}
        organization={organization}
        period={selection.datetime.period}
        project={selection.projects}
        environment={selection.environments}
        start={selection.datetime.start}
        end={selection.datetime.end}
        interval={interval}
        showLoading={true}
        query={queryString}
        includePrevious={false}
      >
        {({loading, reloading, timeseriesData}) => (
          <LineChart
            loading={loading}
            reloading={reloading}
            series={[...timeseriesData, getCurrentEventMarker(currentEvent)]}
            seriesOptions={{
              showSymbol: false,
            }}
            onClick={series =>
              handleClick(series, {
                api,
                organization,
                queryString,
                interval,
                selection,
                location,
              })
            }
            tooltip={tooltip}
            xAxis={xAxisOptions}
            grid={{
              left: '20px',
              right: '10px',
            }}
          />
        )}
      </EventsRequest>
    </Panel>
  );
};
ModalLineGraph.propTypes = {
  api: PropTypes.object.isRequired,
  currentEvent: SentryTypes.Event.isRequired,
  location: PropTypes.object.isRequired,
  organization: SentryTypes.Organization.isRequired,
  selection: PropTypes.object.isRequired,
  view: PropTypes.object.isRequired,
};

export default withGlobalSelection(withApi(ModalLineGraph));
