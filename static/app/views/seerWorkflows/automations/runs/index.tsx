import {NotFound} from 'sentry/components/errors/notFound';
import {useAutomationsEnabled} from 'sentry/views/seerWorkflows/utils';

import {RunsTable} from './runsTable';

export default function AutomationRunsList() {
  const automationsEnabled = useAutomationsEnabled();

  if (!automationsEnabled) {
    return <NotFound />;
  }

  return <RunsTable />;
}
