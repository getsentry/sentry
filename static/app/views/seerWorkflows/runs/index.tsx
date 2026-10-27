import {NotFound} from 'sentry/components/errors/notFound';
import {RunsTable} from 'sentry/views/seerWorkflows/runs/runsTable';
import {useAutomationsEnabled} from 'sentry/views/seerWorkflows/utils';

export default function AutomationRunsList() {
  const automationsEnabled = useAutomationsEnabled();

  if (!automationsEnabled) {
    return <NotFound />;
  }

  return <RunsTable />;
}
