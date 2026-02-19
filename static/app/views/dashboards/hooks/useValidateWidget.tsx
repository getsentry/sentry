import {validateWidgetRequest} from 'sentry/actionCreators/dashboards';
import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {hasOnDemandMetricWidgetFeature} from 'sentry/utils/onDemandMetrics/features';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {ValidateWidgetResponse, Widget} from 'sentry/views/dashboards/types';
import {cleanWidgetForRequest} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';

export function useValidateWidgetQuery(_widget: Widget) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const cleanedWidget = cleanWidgetForRequest(_widget);

  // Pin title and description to avoid re-triggering validation on
  // every change in title/description.
  cleanedWidget.title = 'sentinel';
  cleanedWidget.description = 'sentinel';

  const data = useApiQuery<ValidateWidgetResponse>(
    validateWidgetRequest(organization.slug, cleanedWidget, selection),
    {
      staleTime: 10000,
      enabled: hasOnDemandMetricWidgetFeature(organization),
    }
  );

  return data;
}
