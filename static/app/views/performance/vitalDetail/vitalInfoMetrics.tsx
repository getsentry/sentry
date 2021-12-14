import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {WebVital} from 'sentry/utils/discover/fields';
import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';

import {VitalBar} from '../landing/vitalsCards';
import {getVitalData} from '../landing/widgets/widgets/vitalWidgetMetrics';

import {vitalToMetricsField} from './utils';

type ViewProps = Pick<
  EventView,
  'environment' | 'project' | 'query' | 'start' | 'end' | 'statsPeriod'
>;

type Props = ViewProps & {
  orgSlug: Organization['slug'];
  vital: WebVital;
  hideBar?: boolean;
  hideStates?: boolean;
  hideVitalPercentNames?: boolean;
  hideDurationDetail?: boolean;
};

function VitalInfoMetrics({
  orgSlug,
  project: projectIds,
  start,
  end,
  statsPeriod,
  query,
  environment,
  vital,
  hideBar,
  hideStates,
  hideVitalPercentNames,
  hideDurationDetail,
}: Props) {
  const api = useApi();

  const mutableSearch = new MutableSearch(query);
  const transactions = mutableSearch.getFilterValues('transaction');
  const transaction = transactions.length > 1 ? '' : transactions[0];
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
      query={mutableSearch.formatString()} // TODO(metrics): not all tags will be compatible with metrics
      groupBy={['transaction', 'measurement_rating']}
    >
      {({loading: isLoading, response}) => {
        const data = {
          [vital]: getVitalData(transaction, field, response),
        };
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
      }}
    </MetricsRequest>
  );
}

export default VitalInfoMetrics;
