import Badge from 'sentry/components/badge';

function ReplayCountBadge({count}: {count: undefined | number}) {
  const display = count && count > 50 ? '50+' : count ?? null;
  if (display === null) {
    return null;
  }
  return <Badge text={display} />;
}

export default ReplayCountBadge;
