import React from 'react';
import {Location} from 'history';

import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {WebVital} from 'sentry/utils/discover/fields';
import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import VitalsCardDiscoverQuery from 'sentry/utils/performance/vitals/vitalsCardsDiscoverQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';

import {VitalBar} from '../landing/vitalsCards';
import {getVitalData} from '../landing/widgets/widgets/vitalWidgetMetrics';

import {vitalToMetricsField} from './utils';

type ViewProps = Pick<
  EventView,
  'environment' | 'project' | 'start' | 'end' | 'statsPeriod'
>;

type Props = ViewProps & {
  location: Location;
  vital: WebVital | WebVital[];
  orgSlug: Organization['slug'];
  hideBar?: boolean;
  hideStates?: boolean;
  hideVitalPercentNames?: boolean;
  hideDurationDetail?: boolean;
  isMetricsData?: boolean;
};

function VitalInfo({
  orgSlug,
  start,
  end,
  statsPeriod,
  project: projectIds,
  environment,
  vital,
  location,
  hideBar,
  hideStates,
  hideVitalPercentNames,
  hideDurationDetail,
  isMetricsData,
}: Props) {
  const api = useApi();

  const vitals = Array.isArray(vital) ? vital : [vital];

  function renderContent({
    data,
    isLoading,
  }: Pick<React.ComponentProps<typeof VitalBar>, 'data' | 'isLoading'>) {
    return (
      <VitalBar
        isLoading={isLoading}
        data={data}
        vital={vital}
        showBar={!hideBar}
        showStates={!hideStates}
        showVitalPercentNames={!hideVitalPercentNames}
        showDurationDetail={!hideDurationDetail}
      />
    );
  }

  if (isMetricsData) {
    const query = decodeScalar(location.query.query, '');
    const fields = vitals.map(v => `count(${vitalToMetricsField[v]})`);

    return (
      <MetricsRequest
        api={api}
        orgSlug={orgSlug}
        start={start}
        end={end}
        statsPeriod={statsPeriod}
        project={projectIds}
        environment={environment}
        field={fields}
        query={new MutableSearch(query).formatString()} // TODO(metrics): not all tags will be compatible with metrics
        groupBy={['measurement_rating']}
      >
        {({loading: isLoading, response}) => {
          const data = vitals.reduce((acc, v, index) => {
            acc[v] = getVitalData({
              field: fields[index],
              response,
            });
            return acc;
          }, {});
          return renderContent({data, isLoading});
        }}
      </MetricsRequest>
    );
  }
  return (
    <VitalsCardDiscoverQuery location={location} vitals={vitals}>
      {({isLoading, vitalsData}) => renderContent({isLoading, data: vitalsData})}
    </VitalsCardDiscoverQuery>
  );
}

export default VitalInfo;
