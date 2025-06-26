import {t} from 'sentry/locale';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {Referrer} from 'sentry/views/insights/pages/platform/laravel/referrers';
import {BaseTrafficWidget} from 'sentry/views/insights/pages/platform/shared/baseTrafficWidget';

export default function OverviewPageloadsChartWidget(props: LoadableChartWidgetProps) {
  return (
    <BaseTrafficWidget
      id="overviewPageloadsChartWidget"
      title={t('Pageloads')}
      trafficSeriesName={t('Pageloads')}
      baseQuery={'span.op:[pageload]'}
      referrer={Referrer.REQUESTS_CHART}
      {...props}
    />
  );
}
