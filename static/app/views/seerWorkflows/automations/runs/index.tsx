import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {NotFound} from 'sentry/components/errors/notFound';
import {t} from 'sentry/locale';
import {RunsTable} from 'sentry/views/seerWorkflows/automations/runs/runsTable';
import {useAutomationsEnabled} from 'sentry/views/seerWorkflows/utils';

export default function AutomationRunsList() {
  const automationsEnabled = useAutomationsEnabled();

  if (!automationsEnabled) {
    return <NotFound />;
  }

  return (
    <Stack gap="lg">
      <Text as="p" variant="muted">
        {t('Historical runs of Sentry workflows for this organization.')}
      </Text>
      <RunsTable />
    </Stack>
  );
}
