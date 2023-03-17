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

export function PHPCronQuickStart({slug: slugOrUndefined}: QuickStartProps) {
  const slug = slugOrUndefined ?? DEFAULT_MONITOR_SLUG;
  const initializeCode = `
  \\Sentry\\init(['dsn' => '<dsn_here>' ]);
  `;

  const checkInSuccessCode = `
  <?php

  # Notify Sentry your job is running:
  $event = Event::createCheckIn();
  $checkIn = new CheckIn(
      monitorSlug: ${slug},
      status: CheckInStatus::inProgress(),
  );
  $event->setCheckIn($checkIn);
  $this->hub->captureEvent($event);

  # Execute your scheduled task here...

  # Notify Sentry your job has completed successfully:
  $event = Event::createCheckIn();
  $event->setCheckIn(new CheckIn(
      id: $checkIn->getId(),
      monitorSlug: ${slug},
      status: CheckInStatus::ok(),
  ));
  $this->hub->captureEvent($event);
  `;

  const checkInFailCode = `
  # Notify Sentry your job has failed:
  $event = Event::createCheckIn();
  $event->setCheckIn(new CheckIn(
      id: $checkIn->getId(),
      monitorSlug: ${slug},
      status: CheckInStatus::failed(),
  ));
  $this->hub->captureEvent($event);
  `;
  return (
    <Fragment>
      <Text>Initialize Sentry PHP:</Text>
      <CodeSnippet language="php">{initializeCode}</CodeSnippet>
      <Text>Usage:</Text>
      <CodeSnippet language="php">{checkInSuccessCode}</CodeSnippet>
      <Text>In case your job execution fails:</Text>
      <CodeSnippet language="php">{checkInFailCode}</CodeSnippet>
    </Fragment>
  );
}

export function NodeJsCronQuickStart({slug}) {
  const checkInSuccessCode = `
  import fetch from "node-fetch";

  const org_slug = "gabriels-org";
  const monitor_slug = "${slug ?? DEFAULT_MONITOR_SLUG}";
  const project_dsn =
    "<your_dsn_here>";

  // Notify Sentry your job is running
  await fetch(
    \`https://sentry.io/api/0/organizations/\${org_slug}/monitors/\${monitor_slug}/checkins/\`,
    {
      method: "POST",
      headers: {
        Authorization: \`DSN \${project_dsn}\`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "in_progress" }),
    }
  );

  // Execute your scheduled task code here...

  // Notify Sentry your job has completed successfully:
  await fetch(
    \`https://sentry.io/api/0/organizations/\${org_slug}/monitors/\${monitor_slug}/checkins/latest/\`,
    {
      method: "PUT",
      headers: {
        Authorization: \`DSN \${project_dsn}\`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "ok" }),
    }
  );
  `;

  const checkInFailCode = `
  // Notify Sentry your job has failed:
  await fetch(
    \`https://sentry.io/api/0/organizations/\${org_slug}/monitors/\${monitor_slug}/checkins/latest/\`,
    {
      method: "PUT",
      headers: {
        Authorization: \`DSN \${project_dsn}\`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "failed" }),
    }
  );
  `;
  return (
    <Fragment>
      <CodeSnippet language="javascript">{checkInSuccessCode}</CodeSnippet>
      <Text>In case your job execution fails:</Text>
      <CodeSnippet language="javascript">{checkInFailCode}</CodeSnippet>
    </Fragment>
  );
}
