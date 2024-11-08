import IndicatorBadge from 'sentry/components/devtoolbar/components/indicatorBadge';

import useAlertsCount from './useAlertsCount';

export default function AlertBadge() {
  const {data: count} = useAlertsCount();

  if (count === undefined || count < 1) {
    return null;
  }
  return <IndicatorBadge variant="red" />;
}
