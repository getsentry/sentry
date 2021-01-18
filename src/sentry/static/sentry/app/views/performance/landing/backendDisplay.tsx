import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import withApi from 'app/utils/withApi';

import _Footer from '../charts/footer';
import {getBackendAxisOptions} from '../data';
import {getTransactionSearchQuery} from '../utils';

import DurationChart from './durationChart';
import HistogramChart from './histogramChart';

type Props = {
  location: Location;
  organization: Organization;
  eventView: EventView;
};

function BackendDisplay(props: Props) {
  const {eventView, location, organization} = props;
  const field = 'transaction.duration';

  const onFilterChange = (minValue, maxValue) => {
    const filterString = getTransactionSearchQuery(location);
    const conditions = tokenizeSearch(filterString);
    conditions.setTagValues(field, [
      `>=${Math.round(minValue)}`,
      `<${Math.round(maxValue)}`,
    ]);
    const query = stringifyQueryObject(conditions);

    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        query: String(query).trim(),
      },
    });
  };

  const axisOptions = getBackendAxisOptions(organization);
  const leftAxis = axisOptions[0].value; // TODO: Temporary until backend changes
  const rightAxis = axisOptions[1].value; // TODO: Temporary until backend changes

  return (
    <Panel>
      <DoubleChartContainer>
        <DurationChart
          field="p75(transaction.duration)"
          eventView={eventView}
          organization={organization}
          title={t('Duration p75')}
          titleTooltip={t(
            'This is the 75th percentile over time of the duration of the transaction.'
          )}
        />
        <HistogramChart
          field="transaction.duration"
          {...props}
          onFilterChange={onFilterChange}
          title={t('Duration Distribution')}
          titleTooltip={t('This is a histogram of the duration of the transaction.')}
        />
      </DoubleChartContainer>

      <Footer
        options={getBackendAxisOptions(organization)}
        leftAxis={leftAxis}
        rightAxis={rightAxis}
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
`;

const Footer = withApi(_Footer);

export default BackendDisplay;
