import {t} from 'sentry/locale';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {BaseTrafficWidget} from 'sentry/views/insights/pages/platform/shared/baseTrafficWidget';

export default function OverviewRequestsChartWidget(props: LoadableChartWidgetProps) {
  return (
    <BaseTrafficWidget
      id="overviewRequestsChartWidget"
      title={t('Requests')}
      trafficSeriesName={t('Requests')}
      baseQuery={'span.op:http.server'}
      {...props}
    />
  );
}
