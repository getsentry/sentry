import {
  convertDiscoverFieldsToMetrics,
  convertDiscoverFieldsToMetricsGroupBys,
} from 'sentry/utils/metrics/fields';
import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import {useMetricsSwitch} from 'sentry/views/performance/metricsSwitch';

import {decodeScalar} from '../queryString';
import {MutableSearch} from '../tokenizeSearch';
import withApi from '../withApi';

import DiscoverQuery, {DiscoverQueryPropsWithThresholds} from './discoverQuery';
import {encodeSort} from './eventView';
import {getAggregateAlias} from './fields';

function DiscoverOrMetricsQuery(props: DiscoverQueryPropsWithThresholds) {
  const {isMetricsData} = useMetricsSwitch(); // TODO(metrics): decision logic will be dynamic in the future, not switch toggle

  if (isMetricsData) {
    const {eventView, orgSlug, api, location} = props;
    const {start, end, statsPeriod, project, environment, sorts} = eventView;
    const fields = eventView.fields.map(({field}) => field);

    const secondaryOrderBy = sorts[1]; // TODO(metrics): we do not support key transactions right now
    const orderBy = encodeSort({
      ...secondaryOrderBy,
      field:
        convertDiscoverFieldsToMetrics(
          fields.find(field => getAggregateAlias(field) === secondaryOrderBy.field) ?? '' // convert 75_measurements_fcp to p75(measurements.fcp)
        ) ?? '',
    });

    return (
      <MetricsRequest
        api={api}
        orgSlug={orgSlug}
        start={start}
        end={end}
        statsPeriod={statsPeriod}
        project={project}
        environment={environment}
        query={new MutableSearch(eventView.query).formatString()}
        field={convertDiscoverFieldsToMetrics(fields)}
        groupBy={convertDiscoverFieldsToMetricsGroupBys(fields)}
        orderBy={orderBy}
        limit={50}
        cursor={decodeScalar(location.query.cursor)}
        includeDeprecatedTabularData
      >
        {(props as any).children}
      </MetricsRequest>
    );
  }

  return <DiscoverQuery {...props} />;
}

export default withApi(DiscoverOrMetricsQuery);
