import {useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Panel} from 'app/components/panels';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import {tokenizeSearch} from 'app/utils/tokenizeSearch';
import withApi from 'app/utils/withApi';

import _Footer from '../../charts/footer';
import {AxisOption} from '../../data';
import {getTransactionSearchQuery} from '../../utils';

import {SingleAxisChart} from './singleAxisChart';
import {getAxisOrBackupAxis, getBackupAxes} from './utils';

type Props = {
  location: Location;
  organization: Organization;
  eventView: EventView;
  axisOptions: AxisOption[];
  leftAxis: AxisOption;
  rightAxis: AxisOption;
};

function DoubleAxisDisplay(props: Props) {
  const {eventView, location, organization, axisOptions, leftAxis, rightAxis} = props;

  const [usingBackupAxis, setUsingBackupAxis] = useState(false);

  const onFilterChange = (field: string) => (minValue, maxValue) => {
    const filterString = getTransactionSearchQuery(location);

    const conditions = tokenizeSearch(filterString);
    conditions.setTagValues(field, [
      `>=${Math.round(minValue)}`,
      `<${Math.round(maxValue)}`,
    ]);
    const query = conditions.formatString();

    trackAnalyticsEvent({
      eventKey: 'performance_views.landingv2.display.filter_change',
      eventName: 'Performance Views: Landing v2 Display Filter Change',
      organization_id: parseInt(organization.id, 10),
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
  grid-gap: ${space(3)};
  min-height: 282px;
`;

const Footer = withApi(_Footer);

export default DoubleAxisDisplay;
