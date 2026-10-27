import {NotFound} from 'sentry/components/errors/notFound';
import {useAutomationsEnabled} from 'sentry/views/seerWorkflows/utils';

export default function AutomationRuns() {
  const automationsEnabled = useAutomationsEnabled();

  if (!automationsEnabled) {
    return <NotFound />;
  }

  return null;
}
