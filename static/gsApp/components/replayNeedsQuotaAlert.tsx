import {Alert} from 'sentry/components/core/alert';

export default function ReplayNeedsQuotaAlert() {
  return (
    <Alert type="warning">You need quota! Go get some on the subscription page.</Alert>
  );
}
