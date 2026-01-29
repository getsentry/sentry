import {OnDemandWarningIcon} from 'sentry/components/alerts/onDemandMetricAlert';
import {tct} from 'sentry/locale';
import {isOnDemandQueryString} from 'sentry/utils/onDemandMetrics';
import {hasOnDemandMetricWidgetFeature} from 'sentry/utils/onDemandMetrics/features';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {
  OnDemandExtractionState,
  type ValidateWidgetResponse,
  type WidgetQuery,
} from 'sentry/views/dashboards/types';

export function WidgetOnDemandQueryWarning(props: {
  query: WidgetQuery;
  queryIndex: number;
  validatedWidgetResponse: UseApiQueryResult<ValidateWidgetResponse, RequestError>;
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
        variant="warning"
      />
    );
  }

  return (
    <OnDemandWarningIcon
      msg={tct(
        'We don’t routinely collect metrics from this property. However, we’ll do so [strong:once this widget has been saved.]',
        {strong: <strong />}
      )}
      variant="warning"
    />
  );
}
