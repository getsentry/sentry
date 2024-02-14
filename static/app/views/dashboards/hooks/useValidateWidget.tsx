import {validateWidgetRequest} from 'sentry/actionCreators/dashboards';
import type {Client} from 'sentry/api';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import type {ValidateWidgetResponse, Widget} from '../types';

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

export function useValidateWidgetQuery(widget: Widget) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const widgetWithOnDemand: Widget = {
    ...widget,
    queries: widget.queries.map(q => ({
      ...q,
      onDemandExtractionDisabled: false,
    })),
  };

  const data = useApiQuery<ValidateWidgetResponse>(
    validateWidgetRequest(organization.slug, widgetWithOnDemand, selection),
    {staleTime: 10000}
  );
  return data;
}
