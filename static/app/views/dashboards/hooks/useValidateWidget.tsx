import {validateWidgetRequest} from 'sentry/actionCreators/dashboards';
import type {Client} from 'sentry/api';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {hasOnDemandMetricWidgetFeature} from 'sentry/utils/onDemandMetrics/features';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import type {ValidateWidgetResponse, Widget} from '../types';
import {cleanWidgetForRequest} from '../widgetCard/genericWidgetQueries';

export function validateWidget(
  api: Client,
  orgId: string,
  widget: Widget
): Promise<undefined> {
  const {selection} = PageFiltersStore.getState();
  const widgetQuery = validateWidgetRequest(orgId, widget, selection);
  const promise: Promise<undefined> = api.requestPromise(widgetQuery[0], widgetQuery[1]);
  return promise;
}

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
