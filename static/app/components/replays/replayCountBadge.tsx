import {Badge} from 'sentry/components/core/badge';

function ReplayCountBadge({count}: {count: undefined | number}) {
  const display = count && count > 50 ? '50+' : count ?? null;
  return <Badge type="default">{display}</Badge>;
}

export default ReplayCountBadge;
