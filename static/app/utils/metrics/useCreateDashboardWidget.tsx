import {useMemo} from 'react';
import {urlEncode} from '@sentry/utils';

import {openAddToDashboardModal} from 'sentry/actionCreators/modal';
import {Organization} from 'sentry/types';
import {isCustomMetric, MetricDisplayType, MetricsQuery} from 'sentry/utils/metrics';
import {MRIToField} from 'sentry/utils/metrics/mri';
import useRouter from 'sentry/utils/useRouter';
import {DashboardWidgetSource, WidgetType} from 'sentry/views/dashboards/types';

export function useCreateDashboardWidget(
  organization: Organization,
  {projects, environments, datetime, op, mri, groupBy, query}: MetricsQuery,
  displayType?: MetricDisplayType
) {
  const router = useRouter();
  const {start, end, period} = datetime;

  return useMemo(() => {
    if (
      !mri ||
      !op ||
      !isCustomMetric({mri}) ||
      !organization.access.includes('member:write')
    ) {
      return undefined;
    }

    const field = MRIToField(mri, op);
    const limit = !groupBy?.length ? 1 : 10;

    const widgetQuery = {
      name: '',
      aggregates: [field],
      columns: groupBy ?? [],
      fields: [field],
      conditions: query ?? '',
      orderby: '',
    };

    const urlWidgetQuery = urlEncode({
      ...widgetQuery,
      aggregates: field,
      fields: field,
      columns: groupBy?.join(',') ?? '',
    });

    const widgetAsQueryParams = {
      source: DashboardWidgetSource.DDM,
      start,
      end,
      statsPeriod: period,
      defaultWidgetQuery: urlWidgetQuery,
      defaultTableColumns: [],
      defaultTitle: 'DDM Widget',
      environment: environments,
      displayType,
      project: projects,
    };

    return () =>
      openAddToDashboardModal({
        organization,
        selection: {
          projects,
          environments,
          datetime,
        },
        widget: {
          title: 'DDM Widget',
          displayType,
          widgetType: WidgetType.METRICS,
          limit,
          queries: [widgetQuery],
        },
        router,
        widgetAsQueryParams,
        location: router.location,
      });
  }, [
    datetime,
    displayType,
    end,
    environments,
    groupBy,
    mri,
    op,
    organization,
    period,
    projects,
    query,
    router,
    start,
  ]);
}
