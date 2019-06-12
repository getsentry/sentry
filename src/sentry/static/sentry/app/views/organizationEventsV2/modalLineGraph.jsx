import React from 'react';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import {getInterval, useShortInterval} from 'app/components/charts/utils';
import {getFormattedDate} from 'app/utils/dates';
import EventsRequest from 'app/views/organizationEvents/utils/eventsRequest';
import LineChart from 'app/components/charts/lineChart';
import {Panel} from 'app/components/panels';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';

const defaultGetCategory = () => t('Events');

const ModalLineGraph = props => {
  const {api, groupId, organization, location, selection} = props;

  const isUtc = selection.datetime.utc;
  const dateFormat = 'lll';

  const interval = getInterval(selection.datetime, true);
  const hasShortInterval = useShortInterval(selection.datetime);

  const xAxisOptions = {
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
        groupId={groupId}
      >
        {({loading, reloading, timeseriesData}) => (
          <LineChart
            loading={loading}
            reloading={reloading}
            series={timeseriesData}
            seriesOptions={{
              showSymbol: false,
            }}
            tooltip={tooltip}
            xAxis={xAxisOptions}
            grid={{
              left: '30px',
              right: '18px',
            }}
          />
        )}
      </EventsRequest>
    </Panel>
  );
};
ModalLineGraph.propTypes = {
  api: PropTypes.object.isRequired,
  organization: SentryTypes.Organization.isRequired,
  groupId: PropTypes.string.isRequired,
  location: PropTypes.object.isRequired,
  selection: PropTypes.object.isRequired,
};

export default withGlobalSelection(withApi(ModalLineGraph));
