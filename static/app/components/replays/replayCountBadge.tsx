import {Badge} from '@sentry/scraps/badge';

function ReplayCountBadge({count}: {count: undefined | number}) {
  const display = count && count > 50 ? '50+' : (count ?? null);
  return <Badge variant="muted">{display}</Badge>;
}

export default ReplayCountBadge;
