import {CodeBlock} from '@sentry/scraps/code';
import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import type {AlertDebugFormData} from 'admin/views/alertsDebug/types';

interface AlertDebugResultsProps {
  results: AlertDebugFormData;
}

export function AlertDebugResults({results}: AlertDebugResultsProps) {
  return (
    <Stack gap="md">
      <Heading as="h4">Results</Heading>
      <CodeBlock language="json">{JSON.stringify(results, null, 2)}</CodeBlock>
    </Stack>
  );
}
