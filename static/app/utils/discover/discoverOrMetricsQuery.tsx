import {
  convertDiscoverFieldsToMetrics,
  convertDiscoverFieldsToMetricsGroupBys,
} from 'sentry/utils/metrics/fields';
import MetricsRequest from 'sentry/utils/metrics/metricsRequest';
import {useMetricsSwitch} from 'sentry/views/performance/metricsSwitch';

import {MutableSearch} from '../tokenizeSearch';
import withApi from '../withApi';

import DiscoverQuery, {DiscoverQueryPropsWithThresholds} from './discoverQuery';

function DiscoverOrMetricsQuery(props: DiscoverQueryPropsWithThresholds) {
  const {isMetricsData} = useMetricsSwitch(); // TODO(metrics): decision logic will be dynamic in the future, not switch toggle

  if (isMetricsData) {
    const {eventView, orgSlug, api} = props;
    const {start, end, statsPeriod, project, environment} = eventView;
    const fields = eventView.fields.map(({field}) => field);

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
        orderBy={undefined} // TODO(metrics): waiting for api team_key_transactions sorting
        includeTabularData
      >
        {(props as any).children}
      </MetricsRequest>
    );
  }

  return <DiscoverQuery {...props} />;
}

export default withApi(DiscoverOrMetricsQuery);
