import CountBadge from '../countBadge';

import useAlertsCount from './useAlertsCount';

export default function AlertCountBadge() {
  const {data: count} = useAlertsCount();

  if (count === undefined) {
    return null;
  }
  return <CountBadge value={count} />;
}
