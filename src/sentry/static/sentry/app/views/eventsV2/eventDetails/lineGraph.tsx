import React from 'react';
import PropTypes from 'prop-types';
import {browserHistory} from 'react-router';
import styled from 'react-emotion';
import {Location} from 'history';

import {Client} from 'app/api';
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
import {Event, Organization, GlobalSelection} from 'app/types';

import {generateEventDetailsRoute, generateEventSlug} from './utils';
import {PIN_ICON} from '../data';
import EventView from '../eventView';

/**
 * Generate the data to display a vertical line for the current
 * event on the graph.
 */
const getCurrentEventMarker = (currentEvent: Event) => {
  const title = t('Current Event');
  const eventTime = +new Date(
    currentEvent.dateCreated || (currentEvent.endTimestamp || 0) * 1000
  );

  return {
    type: 'line',
    data: [],
    markLine: MarkLine({
      symbol: [PIN_ICON, 'none'],
      symbolSize: [16, 150],
      lineStyle: {
        normal: {
          color: theme.redLight,
          type: 'solid',
          width: 1,
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
 * When a user clicks on a marker we want to update the events details page
 * to display an event from that time slice. While each graph slice
 * could contain thousands of events, we do a search to get the latest
 * event in the slice.
 */
const handleClick = async function(
  series,
  {
    api,
    currentEvent,
    organization,
    queryString,
    field,
    interval,
    selection,
    eventView,
  }: {
    api: Client;
    currentEvent: Event;
    organization: Organization;
    queryString: string;
    field: string[];
    interval: string;
    selection: GlobalSelection;
    eventView: EventView;
  }
) {
  // Get the timestamp that was clicked.
  const value = series.value[0];

  // If the current fieldlist has a timestamp column sort
  // by that. If there are no timestamp fields we will get non-deterministic
  // results.
  const sortField = field.includes('timestamp')
    ? 'timestamp'
    : field.includes('last_seen')
    ? 'last_seen'
    : null;

  // Get events that match the clicked timestamp
  // taking into account the group and current environment & query
  const query: any = {
    environment: selection.environments,
    start: getUtcDateString(value),
    end: getUtcDateString(value + intervalToMilliseconds(interval)),
    limit: 1,
    referenceEvent: `${currentEvent.projectSlug}:${currentEvent.eventID}`,
    query: queryString,
    field,
  };
  if (sortField !== null) {
    query.sort = sortField;
  }

  const url = `/organizations/${organization.slug}/eventsv2/`;
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
  if (!response.data || !response.data.length) {
    // Did not find anything.
    return;
  }

  const event = response.data[0];
  const eventSlug = generateEventSlug(event);

  browserHistory.push({
    pathname: generateEventDetailsRoute({eventSlug, orgSlug: organization.slug}),
    query: eventView.generateQueryStringObject(),
  });
};

type LineGraphProps = {
  api: Client;
  organization: Organization;
  location: Location;
  currentEvent: Event;
  eventView: EventView;
  selection: GlobalSelection;
};

/**
 * Render a graph of event volumes for the current group + event.
 */
const LineGraph = (props: LineGraphProps) => {
  const {api, organization, location, selection, currentEvent, eventView} = props;

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

  const queryString = eventView.getQuery(location.query.query);
  const referenceEvent = `${currentEvent.projectSlug}:${currentEvent.eventID}`;

  return (
    <StyledPanel>
      <EventsRequest
        api={api}
        organization={organization}
        period={selection.datetime.period}
        project={selection.projects}
        environment={selection.environments}
        // TODO(ts): adjust. Expects date, got strings
        start={selection.datetime.start as any}
        end={selection.datetime.end as any}
        interval={interval}
        showLoading
        query={queryString}
        field={eventView.getFields()}
        referenceEvent={referenceEvent}
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
                field: eventView.getFields(),
                api,
                organization,
                currentEvent,
                interval,
                selection,
                queryString,
                eventView,
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
    </StyledPanel>
  );
};

// eChart does not recalculate width

const StyledPanel = styled(Panel)`
  .echarts-for-react div:first-child {
    width: 100% !important;
  }
  image {
    y: 0;
  }
`;

LineGraph.propTypes = {
  api: PropTypes.object.isRequired,
  currentEvent: SentryTypes.Event.isRequired,
  location: PropTypes.object.isRequired,
  organization: SentryTypes.Organization.isRequired,
  selection: PropTypes.object.isRequired,
} as any;

export default withGlobalSelection(withApi(LineGraph));
