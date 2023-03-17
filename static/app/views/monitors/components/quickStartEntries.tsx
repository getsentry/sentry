import {Fragment} from 'react';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import Text from 'sentry/components/text';

export interface QuickStartProps {
  slug?: string;
}

const DEFAULT_MONITOR_SLUG = '<monitor_slug_here>';

export function PythonCronQuickStart({slug}: QuickStartProps) {
  const code = `
  from sentry_sdk.crons import monitor

  # Add this decorator to instrument your python function
  @monitor(monitor_slug='${slug ?? DEFAULT_MONITOR_SLUG}')
  def tell_the_world(msg):
    print(msg)
  `;
  return <CodeSnippet language="python">{code}</CodeSnippet>;
}

export function CLICronQuickStart({slug}: QuickStartProps) {
  const code = `
  # Example for a Python job:
  sentry-cli monitors run ${slug ?? DEFAULT_MONITOR_SLUG} -- python path/to/file
  `;
  return <CodeSnippet language="bash">{code}</CodeSnippet>;
}

export function CurlCronQuickStart({slug: slugOrUndefined}: QuickStartProps) {
  const slug = slugOrUndefined ?? DEFAULT_MONITOR_SLUG;
  const checkInSuccessCode = `
  # Notify Sentry your job is running:
  $ curl -X POST \\
      'https://sentry.io/api/0/organizations/<example-org>/monitors/${slug}/checkins/' \\
      --header 'Authorization: DSN https://examplePublicKey@o0.ingest.sentry.io/0' \\
      --header 'Content-Type: application/json' \\
      --data-raw '{"status": "in_progress"}'

  # Execute your scheduled task here...

  # Notify Sentry your job has completed successfully:
  $ curl -X PUT \\
      'https://sentry.io/api/0/organizations/<example-org>/monitors/${slug}/checkins/latest/' \\
      --header 'Authorization: DSN https://examplePublicKey@o0.ingest.sentry.io/0' \\
      --header 'Content-Type: application/json' \\
      --data-raw '{"status": "ok"}'
  `;

  const checkInFailCode = `
  # Notify Sentry your job has failed:
  $ curl -X PUT \\
      'https://sentry.io/api/0/organizations/<example-org>/monitors/${slug}/checkins/latest/' \\
      --header 'Authorization: DSN https://examplePublicKey@o0.ingest.sentry.io/0' \\
      --header 'Content-Type: application/json' \\
      --data-raw '{"status": "failed"}'
  `;
  return (
    <Fragment>
      <CodeSnippet language="bash">{checkInSuccessCode}</CodeSnippet>
      <Text>In case your job execution fails:</Text>
      <CodeSnippet language="bash">{checkInFailCode}</CodeSnippet>
    </Fragment>
  );
}
