import {Client} from 'sentry/api';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {WebVital} from 'sentry/utils/discover/fields';
import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import {VitalBar} from '../landing/vitalsCards';
import {getVitalData} from '../landing/widgets/widgets/vitalWidgetMetrics';

import {vitalToMetricsField} from './utils';

type ViewProps = Pick<
  EventView,
  'environment' | 'project' | 'query' | 'start' | 'end' | 'statsPeriod'
>;

type Props = ViewProps & {
  api: Client;
  orgSlug: Organization['slug'];
  vital: WebVital;
  isLoading: boolean;
  p75AllTransactions?: number;
  hideBar?: boolean;
  hideStates?: boolean;
  hideVitalPercentNames?: boolean;
  hideDurationDetail?: boolean;
};

function VitalInfoMetrics({
  api,
  orgSlug,
  project: projectIds,
  start,
  end,
  statsPeriod,
  query,
  environment,
  vital,
  p75AllTransactions,
  hideBar,
  hideStates,
  hideVitalPercentNames,
  hideDurationDetail,
  ...props
}: Props) {
  const field = `count(${vitalToMetricsField[vital]})`;

  return (
    <MetricsRequest
      api={api}
      orgSlug={orgSlug}
      start={start}
      end={end}
      statsPeriod={statsPeriod}
      project={projectIds}
      environment={environment}
      field={[field]}
      query={new MutableSearch(query).formatString()} // TODO(metrics): not all tags will be compatible with metrics
      groupBy={['measurement_rating']}
    >
      {({loading: isLoading, response}) => {
        const data = {
          [vital]: {
            ...getVitalData({field, response}),
            p75: p75AllTransactions ?? 0,
          },
        };
        return (
          <VitalBar
            isLoading={isLoading || props.isLoading}
            data={data}
            vital={vital}
            showBar={!hideBar}
            showStates={!hideStates}
            showVitalPercentNames={!hideVitalPercentNames}
            showDurationDetail={!hideDurationDetail}
          />
        );
      }}
    </MetricsRequest>
  );
}

export default VitalInfoMetrics;
