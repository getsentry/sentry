import {Badge} from '@sentry/scraps/badge';

export function ReplayCountBadge({
  count,
  limit,
}: {
  count: undefined | number;
  limit: number;
}) {
  if (count === undefined) {
    return null;
  }
  const display = count > limit ? `${limit}+` : count;
  return <Badge variant="muted">{display}</Badge>;
}
