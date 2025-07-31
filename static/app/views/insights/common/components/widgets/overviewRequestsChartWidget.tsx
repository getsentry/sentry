import {t} from 'sentry/locale';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {BaseTrafficWidget} from 'sentry/views/insights/pages/platform/shared/baseTrafficWidget';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';

export default function OverviewRequestsChartWidget(props: LoadableChartWidgetProps) {
  const {query} = useTransactionNameQuery();
  const fullQuery = `span.op:http.server ${query}`.trim();
  return (
    <BaseTrafficWidget
      id="overviewRequestsChartWidget"
      title={t('Requests')}
      trafficSeriesName={t('Requests')}
      query={fullQuery}
      referrer={Referrer.REQUESTS_CHART}
      {...props}
    />
  );
}
