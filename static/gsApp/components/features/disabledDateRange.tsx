import DateRange from 'sentry/components/timeRangeSelector/dateRange';
import {MAX_PICKABLE_DAYS} from 'sentry/constants';

import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';

type Props = React.ComponentProps<typeof DateRange> & {
  subscription: Subscription;
};

function DisabledDateRange(props: Props) {
  const {subscription} = props;
  const maxPickableDays =
    props.maxPickableDays ?? subscription.planDetails?.retentionDays;

  return <DateRange {...props} maxPickableDays={maxPickableDays || MAX_PICKABLE_DAYS} />;
}

export default withSubscription(DisabledDateRange, {noLoader: true});
