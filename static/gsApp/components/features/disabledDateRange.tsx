import {DateRange} from 'sentry/components/timeRangeSelector/dateRange';
import {MAX_PICKABLE_DAYS} from 'sentry/constants';

import {useSubscription} from 'getsentry/hooks/useSubscription';

type Props = React.ComponentProps<typeof DateRange>;

export function DisabledDateRange(props: Props) {
  const subscription = useSubscription({organization: props.organization});

  if (!subscription) {
    return null;
  }

  const maxPickableDays =
    props.maxPickableDays ?? subscription.planDetails?.retentionDays;

  return <DateRange {...props} maxPickableDays={maxPickableDays || MAX_PICKABLE_DAYS} />;
}
