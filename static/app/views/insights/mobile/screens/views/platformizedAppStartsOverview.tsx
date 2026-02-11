import {FieldKind} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {PrebuiltDashboardRenderer} from 'sentry/views/dashboards/prebuiltDashboardRenderer';
import {WidgetType, type DashboardFilters} from 'sentry/views/dashboards/types';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

export function PlatformizedAppStartsOverview() {
  const location = useLocation();
  const transaction = location.query.transaction as string | undefined;

  const additionalFilters: DashboardFilters | undefined = transaction
    ? {
        globalFilter: [
          {
            dataset: WidgetType.SPANS,
            tag: {
              key: 'transaction',
              name: 'transaction',
              kind: FieldKind.TAG,
            },
            value: `transaction:${transaction}`,
          },
        ],
      }
    : undefined;

  return (
    <PrebuiltDashboardRenderer
      prebuiltId={PrebuiltDashboardId.MOBILE_VITALS_APP_STARTS}
      additionalFilters={additionalFilters}
    />
  );
}
