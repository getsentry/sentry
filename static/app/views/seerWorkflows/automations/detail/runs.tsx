import {NotFound} from 'sentry/components/errors/notFound';
import {useParams} from 'sentry/utils/useParams';
import {RunsTable} from 'sentry/views/seerWorkflows/automations/runs/runsTable';
import {useAutomationsEnabled} from 'sentry/views/seerWorkflows/utils';

export default function AutomationRuns() {
  const automationsEnabled = useAutomationsEnabled();
  const {automationId} = useParams<{automationId: string}>();

  if (!automationsEnabled) {
    return <NotFound />;
  }

  return <RunsTable configId={automationId} />;
}
