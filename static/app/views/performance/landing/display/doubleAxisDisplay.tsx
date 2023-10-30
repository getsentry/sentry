import {useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Panel from 'sentry/components/panels/panel';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withApi from 'sentry/utils/withApi';

import _Footer from '../../charts/footer';
import {AxisOption} from '../../data';
import {getTransactionSearchQuery} from '../../utils';

import {SingleAxisChart} from './singleAxisChart';
import {getAxisOrBackupAxis, getBackupAxes} from './utils';

type Props = {
  axisOptions: AxisOption[];
  eventView: EventView;
  leftAxis: AxisOption;
  location: Location;
  organization: Organization;
  rightAxis: AxisOption;
};

function DoubleAxisDisplay(props: Props) {
  const {eventView, location, organization, axisOptions, leftAxis, rightAxis} = props;

  const [usingBackupAxis, setUsingBackupAxis] = useState(false);

  const onFilterChange = (field: string) => (minValue, maxValue) => {
    const filterString = getTransactionSearchQuery(location);

    const conditions = new MutableSearch(filterString);
    conditions.setFilterValues(field, [
      `>=${Math.round(minValue)}`,
      `<${Math.round(maxValue)}`,
    ]);
    const query = conditions.formatString();
    trackAnalytics('performance_views.landingv2.display.filter_change', {
      organization,

      field,
      min_value: parseInt(minValue, 10),
      max_value: parseInt(maxValue, 10),
    });

    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        query: String(query).trim(),
      },
    });
  };

  const didReceiveMultiAxis = (useBackup: boolean) => {
    setUsingBackupAxis(useBackup);
  };

  const leftAxisOrBackup = getAxisOrBackupAxis(leftAxis, usingBackupAxis);
  const rightAxisOrBackup = getAxisOrBackupAxis(rightAxis, usingBackupAxis);

  const optionsOrBackup = getBackupAxes(axisOptions, usingBackupAxis);

  return (
    <Panel>
      <DoubleChartContainer>
        <SingleAxisChart
          axis={leftAxis}
          onFilterChange={onFilterChange(leftAxis.field)}
          didReceiveMultiAxis={didReceiveMultiAxis}
          usingBackupAxis={usingBackupAxis}
          {...props}
        />
        <SingleAxisChart
          axis={rightAxis}
          onFilterChange={onFilterChange(rightAxis.field)}
          didReceiveMultiAxis={didReceiveMultiAxis}
          usingBackupAxis={usingBackupAxis}
          {...props}
        />
      </DoubleChartContainer>

      <Footer
        options={optionsOrBackup}
        leftAxis={leftAxisOrBackup.value}
        rightAxis={rightAxisOrBackup.value}
        organization={organization}
        eventView={eventView}
        location={location}
      />
    </Panel>
  );
}

const DoubleChartContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(3)};
  min-height: 282px;
`;

const Footer = withApi(_Footer);

export default DoubleAxisDisplay;
