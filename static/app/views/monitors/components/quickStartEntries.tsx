import {Fragment} from 'react';
import merge from 'lodash/merge';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';

export interface QuickStartProps {
  dsnKey?: string;
  orgSlug?: string;
  slug?: string;
}

const VALUE_DEFAULTS = {
  dsnKey: '<my-dsn-key>',
  orgSlug: '<my-organization-slug>',
  slug: '<my-monitor-slug>',
};

function withDefaultProps(props: QuickStartProps): Required<QuickStartProps> {
  return merge(VALUE_DEFAULTS, props);
}

export function PythonCronQuickStart(props: QuickStartProps) {
  const {slug} = withDefaultProps(props);

  const code = `import sentry_sdk
from sentry_sdk.crons import monitor

# Add this decorator to instrument your python function
@monitor(monitor_slug='${slug}')
def tell_the_world(msg):
    print(msg)`;

  return (
    <Fragment>
      <div>
        {tct(
          '[installLink:Install and configure] the Sentry Python SDK (min v1.17.0), then instrument your monitor:',
          {
            installLink: <ExternalLink href="https://docs.sentry.io/platforms/python/" />,
          }
        )}
      </div>
      <CodeSnippet language="python">{code}</CodeSnippet>
    </Fragment>
  );
}

export function PythonCeleryCronQuickStart(props: QuickStartProps) {
  const {slug, dsnKey} = withDefaultProps(props);

  const setupCode = `import sentry_sdk
from sentry_sdk.crons import monitor
from sentry_sdk.integrations.celery import CeleryIntegration

# @signals.celeryd_init.connect
@signals.beat_init.connect
def init_sentry(**kwargs):
    sentry_sdk.init(
        dsn='${dsnKey}',
        integrations=[CeleryIntegration()],
    )
`;

  const linkTaskCode = `@app.task
@monitor(monitor_slug='${slug}')
def tell_the_world(msg):
    print(msg)
`;

  return (
    <Fragment>
      <div>
        {tct(
          '[installLink:Install and configure] the Sentry Python SDK (min v1.17.0), then initialize Sentry either in [celerydInit:celeryd_init] or [beatInit:beat_init] signal:',
          {
            celerydInit: <code />,
            beatInit: <code />,
            installLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/python/guides/celery/" />
            ),
          }
        )}
      </div>
      <CodeSnippet language="python">{setupCode}</CodeSnippet>
      <div>{t('Link your Celery task to your Monitor:')}</div>
      <CodeSnippet language="python">{linkTaskCode}</CodeSnippet>
    </Fragment>
  );
}

export function CLICronQuickStart(props: QuickStartProps) {
  const {slug, dsnKey} = withDefaultProps(props);

  const script = `# Example for a Python script:
export SENTRY_DSN=${dsnKey}
sentry-cli monitors run ${slug} -- python path/to/file`;

  return (
    <Fragment>
      <div>
        {tct(
          'Make sure to [installLink:install the Sentry CLI] (min v2.16.1), then instrument your monitor:',
          {
            installLink: (
              <ExternalLink href="https://docs.sentry.io/product/cli/installation/" />
            ),
          }
        )}
      </div>
      <CodeSnippet language="bash">{script}</CodeSnippet>
    </Fragment>
  );
}

export function CurlCronQuickStart(props: QuickStartProps) {
  const {slug, orgSlug, dsnKey} = withDefaultProps(props);

  const checkInSuccessCode = `# Notify Sentry your job is running:
curl -X POST \\
    'https://sentry.io/api/0/organizations/${orgSlug}/monitors/${slug}/checkins/' \\
    --header 'Authorization: DSN ${dsnKey}' \\
    --header 'Content-Type: application/json' \\
    --data-raw '{"status": "in_progress"}'

# Execute your scheduled task here...

# Notify Sentry your job has completed successfully:
curl -X PUT \\
    'https://sentry.io/api/0/organizations/${orgSlug}/monitors/${slug}/checkins/latest/' \\
    --header 'Authorization: DSN ${dsnKey}' \\
    --header 'Content-Type: application/json' \\
    --data-raw '{"status": "ok"}'`;

  const checkInFailCode = `# Notify Sentry your job has failed:
curl -X PUT \\
    'https://sentry.io/api/0/organizations/${orgSlug}/monitors/${slug}/checkins/latest/' \\
    --header 'Authorization: DSN ${dsnKey}' \\
    --header 'Content-Type: application/json' \\
    --data-raw '{"status": "error"}'`;

  return (
    <Fragment>
      <CodeSnippet language="bash">{checkInSuccessCode}</CodeSnippet>
      <div>{t('To notify Sentry if your job execution fails')}</div>
      <CodeSnippet language="bash">{checkInFailCode}</CodeSnippet>
    </Fragment>
  );
}

export function PHPCronQuickStart(props: QuickStartProps) {
  const {slug} = withDefaultProps(props);

  const checkInSuccessCode = `// 🟡 Notify Sentry your job is running:
$event = Event::createCheckIn();
$checkIn = new CheckIn(
    monitorSlug: '${slug}',
    status: CheckInStatus::inProgress(),
);
$event->setCheckIn($checkIn);
SentrySdk::getCurrentHub()->captureEvent($event);

// Execute your scheduled task here...

// 🟢 Notify Sentry your job has completed successfully:
$event = Event::createCheckIn();
$event->setCheckIn(new CheckIn(
    id: $checkIn->getId(),
    monitorSlug: '${slug}',
    status: CheckInStatus::ok(),
));
SentrySdk::getCurrentHub()->captureEvent($event);`;

  const checkInFailCode = `// 🔴 Notify Sentry your job has failed:
$event = Event::createCheckIn();
$event->setCheckIn(new CheckIn(
    id: $checkIn->getId(),
    monitorSlug: '${slug}',
    status: CheckInStatus::error(),
));
SentrySdk::getCurrentHub()->captureEvent($event);`;

  return (
    <Fragment>
      <div>
        {tct(
          '[installLink:Install and configure] the Sentry PHP SDK (min v3.16.0), then instrument your monitor:',
          {
            installLink: <ExternalLink href="https://docs.sentry.io/platforms/php/" />,
          }
        )}
      </div>
      <CodeSnippet language="php">{checkInSuccessCode}</CodeSnippet>
      <div>{t('To notify Sentry if your job execution fails')}</div>
      <CodeSnippet language="php">{checkInFailCode}</CodeSnippet>
    </Fragment>
  );
}

export function PHPLaravelCronQuickStart(props: QuickStartProps) {
  const {slug} = withDefaultProps(props);

  const code = `protected function schedule(Schedule $schedule)
{
    $schedule->command('emails:send')
        ->everyHour()
        ->sentryMonitor('${slug}'); // add this line
}`;

  return (
    <Fragment>
      <div>
        {tct(
          '[installLink:Install and configure] the Sentry PHP Laravel SDK (min v3.3.1), then add the [sentryMonitor:sentryMonitor()] call to your scheduled tasks defined in your [kernel:app/Console/Kernel.php] file:',
          {
            sentryMonitor: <code />,
            kernel: <code />,
            installLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/php/guides/laravel/" />
            ),
          }
        )}
      </div>
      <CodeSnippet language="php">{code}</CodeSnippet>
    </Fragment>
  );
}

export function NodeJSCronQuickStart(props: QuickStartProps) {
  const {slug} = withDefaultProps(props);

  const checkInSuccessCode = `// 🟡 Notify Sentry your job is running:
const checkInId = Sentry.captureCheckIn({
  monitorSlug: "${slug}",
  status: "in_progress",
});

// Execute your scheduled task here...

// 🟢 Notify Sentry your job has completed successfully:
Sentry.captureCheckIn({
  checkInId,
  monitorSlug: "${slug}",
  status: "ok",
});`;

  const checkInFailCode = `// 🔴 Notify Sentry your job has failed:
Sentry.captureCheckIn({
  checkInId,
  monitorSlug: "${slug}",
  status: "error",
});`;

  return (
    <Fragment>
      <div>
        {tct(
          '[installLink:Install and configure] the Sentry Node SDK (min v7.52), then instrument your monitor:',
          {
            installLink: <ExternalLink href="https://docs.sentry.io/platforms/node/" />,
          }
        )}
      </div>
      <CodeSnippet language="javascript">{checkInSuccessCode}</CodeSnippet>
      <div>{t('To notify Sentry if your job execution fails')}</div>
      <CodeSnippet language="javascript">{checkInFailCode}</CodeSnippet>
    </Fragment>
  );
}
