import {WidgetType} from 'sentry/views/dashboards/types';

import useSubscription from 'getsentry/hooks/useSubscription';
import {isBizPlanFamily} from 'getsentry/utils/billing';

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

/**
 * Returns the retention limit for a given dataset.
 *
 * The retention limit is in relation to the organization's plan.
 *
 * @param dataset - The dataset to get the retention limit for.
 * @returns The date of the last data point that can be displayed in the dashboard and the number of days of retention.
 */
export function useDashboardDatasetRetentionLimit({
  dataset,
}: {
  dataset: WidgetType;
}): [Date, string] {
  const subscription = useSubscription();
  let retentionLimit = NINETY_DAYS;

  switch (dataset) {
    case WidgetType.LOGS:
      retentionLimit = THIRTY_DAYS;
      break;
    case WidgetType.SPANS:
      if (subscription?.planDetails && !isBizPlanFamily(subscription.planDetails)) {
        retentionLimit = THIRTY_DAYS;
      }
      break;
    default:
      break;
  }

  return [
    new Date(Date.now() - retentionLimit),
    retentionLimit === NINETY_DAYS ? '90' : '30',
  ];
}
