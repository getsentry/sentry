import type {Location} from 'history';

import {OnDemandWarningIcon} from 'sentry/components/alerts/onDemandMetricAlert';
import {tct} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {isOnDemandQueryString} from 'sentry/utils/onDemandMetrics';
import {hasOnDemandMetricWidgetFeature} from 'sentry/utils/onDemandMetrics/features';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {
  OnDemandExtractionState,
  type DashboardFilters,
  type ValidateWidgetResponse,
  type WidgetQuery,
  type WidgetType,
} from 'sentry/views/dashboards/types';

interface Props {
  canAddSearchConditions: boolean;
  hideLegendAlias: boolean;
  location: Location;
  onAddSearchConditions: () => void;
  onQueryChange: (queryIndex: number, newQuery: WidgetQuery) => void;
  onQueryConditionChange: (isQueryConditionValid: boolean) => void;
  onQueryRemove: (queryIndex: number) => void;
  queries: WidgetQuery[];
  selection: PageFilters;
  validatedWidgetResponse: UseApiQueryResult<ValidateWidgetResponse, RequestError>;
  widgetType: WidgetType;
  dashboardFilters?: DashboardFilters;
  projectIds?: number[] | readonly number[];
  queryErrors?: Array<Record<string, any>>;
}

export function WidgetOnDemandQueryWarning(props: {
  query: WidgetQuery;
  queryIndex: number;
  validatedWidgetResponse: Props['validatedWidgetResponse'];
}) {
  const organization = useOrganization();
  if (!hasOnDemandMetricWidgetFeature(organization)) {
    return null;
  }
  if (!isOnDemandQueryString(props.query.conditions)) {
    return null;
  }

  if (
    props.validatedWidgetResponse?.data?.warnings?.queries?.[props.queryIndex] ===
    OnDemandExtractionState.DISABLED_SPEC_LIMIT
  ) {
    return (
      <OnDemandWarningIcon
        msg={tct(
          'We don’t routinely collect metrics for this property and you’ve exceeded the maximum number of extracted metrics for your organization. [strong:Please review your other widgets and remove any unused or less valuable queries marked with a (!) sign.]',
          {strong: <strong />}
        )}
        color="yellow300"
      />
    );
  }

  return (
    <OnDemandWarningIcon
      msg={tct(
        'We don’t routinely collect metrics from this property. However, we’ll do so [strong:once this widget has been saved.]',
        {strong: <strong />}
      )}
      color="yellow300"
    />
  );
}
