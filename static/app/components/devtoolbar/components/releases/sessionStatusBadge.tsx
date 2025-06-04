import IndicatorBadge from 'sentry/components/devtoolbar/components/indicatorBadge';
import useSessionStatus from 'sentry/components/devtoolbar/components/releases/useSessionStatus';

export default function CrashCountBadge() {
  const {data} = useSessionStatus();
  const healthySessions = data?.json.groups.find(
    g => g.by['session.status'] === 'healthy'
  )?.totals['sum(session)'];
  const crashSessions = data?.json.groups.find(g => g.by['session.status'] === 'crashed')
    ?.totals['sum(session)'];

  if (!crashSessions || !healthySessions) {
    return null;
  }

  const crashPercent = (crashSessions / (crashSessions + healthySessions)) * 100;

  // over 10% of sessions were crashes
  if (crashPercent > 10) {
    return <IndicatorBadge variant="red" />;
  }
  return null;
}
