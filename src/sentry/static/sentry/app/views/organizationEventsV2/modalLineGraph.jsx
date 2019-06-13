import React from 'react';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import {getInterval, useShortInterval} from 'app/components/charts/utils';
import {getFormattedDate} from 'app/utils/dates';
import EventsRequest from 'app/views/organizationEvents/utils/eventsRequest';
import LineChart from 'app/components/charts/lineChart';
import MarkLine from 'app/components/charts/components/markLine';
import {Panel} from 'app/components/panels';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import theme from 'app/utils/theme';

const defaultGetCategory = () => t('Events');

const getCurrentEventMarker = currentEvent => {
  const title = t('Current Event');
  const eventTime = +new Date(currentEvent.dateCreated);

  return {
    type: 'line',
    data: [],
    markLine: MarkLine({
      // TODO replace the diamond with a custom image.
      symbol: ['diamond', 'none'],
      lineStyle: {
        normal: {
          color: theme.red,
          type: 'dotted',
        },
      },
      tooltip: {
        formatter: ({data}) => {
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

const ModalLineGraph = props => {
  const {api, organization, location, selection, currentEvent} = props;

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
        getCategory={defaultGetCategory}
        showLoading={true}
        query={location.query.query}
        includePrevious={false}
        groupId={currentEvent.groupID}
      >
        {({loading, reloading, timeseriesData}) => (
          <LineChart
            loading={loading}
            reloading={reloading}
            series={[...timeseriesData, getCurrentEventMarker(currentEvent)]}
            seriesOptions={{
              showSymbol: false,
            }}
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
};

export default withGlobalSelection(withApi(ModalLineGraph));
