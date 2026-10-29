import {NotFound} from 'sentry/components/errors/notFound';
import {RunsTable} from 'sentry/views/seerWorkflows/automations/runs/runsTable';
import {useAutomationsEnabled} from 'sentry/views/seerWorkflows/utils';

export default function AutomationRuns() {
  const automationsEnabled = useAutomationsEnabled();

  if (!automationsEnabled) {
    return <NotFound />;
  }

  return <RunsTable />;
}
