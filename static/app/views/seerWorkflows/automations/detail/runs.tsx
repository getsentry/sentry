import {NotFound} from 'sentry/components/errors/notFound';
import {RunsTable} from 'sentry/views/seerWorkflows/runs/runsTable';
import {useAutomationsEnabled} from 'sentry/views/seerWorkflows/utils';

export default function AutomationRuns() {
  const automationsEnabled = useAutomationsEnabled();

  if (!automationsEnabled) {
    return <NotFound />;
  }

  // TODO(aliu): Only show this automation's runs once runs include their config id
  return <RunsTable />;
}
