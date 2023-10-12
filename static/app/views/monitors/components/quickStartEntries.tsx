import {Fragment} from 'react';
import merge from 'lodash/merge';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';

export interface QuickStartProps {
  dsnKey?: string;
  orgId?: string;
  orgSlug?: string;
  projectId?: string;
  publicKey?: string;
  slug?: string;
}

const VALUE_DEFAULTS = {
  dsnKey: '<my-dsn-key>',
  orgId: '<my-organziation-id>',
  orgSlug: '<my-organization-slug>',
  projectId: '<my-project-id>',
  publicKey: '<my-dsn-public-key>',
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
  const {projectId, orgId, slug, publicKey} = withDefaultProps(props);

  const checkInSuccessCode = `SENTRY_INGEST="https://o${orgId}.ingest.sentry.io"
SENTRY_CRONS="\${SENTRY_INGEST}/api/${projectId}/cron/${slug}/${publicKey}/"

# 🟡 Notify Sentry your job is running:
curl "\${SENTRY_CRONS}?status=in_progress"

# Execute your scheduled task here...

# 🟢 Notify Sentry your job has completed successfully:
curl "\${SENTRY_CRONS}?status=ok"`;

  const checkInFailCode = `# 🔴 Notify Sentry your job has failed:
curl "\${SENTRY_CRONS}?status=error"`;

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

export function GoCronQuickStart(props: QuickStartProps) {
  const {slug} = withDefaultProps(props);

  const checkInSuccessCode = `// 🟡 Notify Sentry your job is running:
checkinId := sentry.CaptureCheckIn(
  &sentry.CheckIn{
    MonitorSlug: "${slug}",
    Status:      sentry.CheckInStatusInProgress,
  },
  nil,
)

// Execute your scheduled task here...

// 🟢 Notify Sentry your job has completed successfully:
sentry.CaptureCheckIn(
  &sentry.CheckIn{
    ID:          *checkinId,
    MonitorSlug: "${slug}",
    Status:      sentry.CheckInStatusOK,
  },
  nil,
)`;

  const checkInFailCode = `// 🔴 Notify Sentry your job has failed:
sentry.CaptureCheckIn(
  &sentry.CheckIn{
    ID:          *checkinId,
    MonitorSlug: "${slug}",
    Status:      sentry.CheckInStatusError,
  },
  nil,
)`;

  return (
    <Fragment>
      <div>
        {tct(
          '[installLink:Install and configure] the Sentry Go SDK (min v0.23.0), then instrument your monitor:',
          {
            installLink: <ExternalLink href="https://docs.sentry.io/platforms/go/" />,
          }
        )}
      </div>
      <CodeSnippet language="go">{checkInSuccessCode}</CodeSnippet>
      <div>{t('To notify Sentry if your job execution fails')}</div>
      <CodeSnippet language="go">{checkInFailCode}</CodeSnippet>
    </Fragment>
  );
}

export function JavaCronQuickStart(props: QuickStartProps) {
  const {slug} = withDefaultProps(props);

  const checkInSuccessCode = `import io.sentry.CheckIn;
import io.sentry.CheckInStatus;
import io.sentry.Sentry;
import io.sentry.protocol.SentryId;

// 🟡 Notify Sentry your job is running:
SentryId checkInId = Sentry.captureCheckIn(
    new CheckIn(
        "${slug}",
        CheckInStatus.IN_PROGRESS
    )
);

// Execute your scheduled task here...

// 🟢 Notify Sentry your job has completed successfully:
Sentry.captureCheckIn(
    new CheckIn(
        checkInId,
        "${slug}",
        CheckInStatus.OK
    )
);`;

  const checkInFailCode = `// 🔴 Notify Sentry your job has failed:
Sentry.captureCheckIn(
    new CheckIn(
        checkInId,
        "${slug}",
        CheckInStatus.ERROR
    )
);`;

  return (
    <Fragment>
      <div>
        {tct(
          '[installLink:Install and configure] the Sentry Java SDK (min v6.30.0), then instrument your monitor:',
          {
            installLink: <ExternalLink href="https://docs.sentry.io/platforms/java/" />,
          }
        )}
      </div>
      <CodeSnippet language="java">{checkInSuccessCode}</CodeSnippet>
      <div>{t('To notify Sentry if your job execution fails')}</div>
      <CodeSnippet language="java">{checkInFailCode}</CodeSnippet>
    </Fragment>
  );
}

export function JavaSpringBootCronQuickStart(props: QuickStartProps) {
  const {slug} = withDefaultProps(props);

  const code = `import io.sentry.spring.jakarta.checkin.SentryCheckIn;

@Component
public class CustomJob {

  @Scheduled(fixedRate = 3 * 60 * 1000L)
  @SentryCheckIn("${slug}") // 👈
  void execute() throws InterruptedException {
    // your task code
  }
}`;

  return (
    <Fragment>
      <div>
        {tct(
          '[installLink:Install and configure] the Sentry Spring Boot SDK (min v6.30.0), then instrument your monitor:',
          {
            installLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/java/guides/spring-boot/" />
            ),
          }
        )}
      </div>
      <CodeSnippet language="java">{code}</CodeSnippet>
    </Fragment>
  );
}

export function JavaQuartzCronQuickStart(props: QuickStartProps) {
  const {slug} = withDefaultProps(props);

  const code = `import io.sentry.quartz.SentryJobListener;

// you can set the monitor slug on the job detail
JobDetailFactoryBean jobDetailFactory = new JobDetailFactoryBean();
jobDetailFactory.setJobDataAsMap(Collections.singletonMap(SentryJobListener.SENTRY_SLUG_KEY, "${slug}"));

// you can also set the monitor slug on the trigger
SimpleTriggerFactoryBean trigger = new SimpleTriggerFactoryBean();
trigger.setJobDataAsMap(Collections.singletonMap(SENTRY_SLUG_KEY, "${slug}"));`;

  return (
    <Fragment>
      <div>
        {tct(
          '[installLink:Install and configure] the Sentry Java SDK (min v6.30.0), make sure `SentryJobListener` is [configureLink:configured], then instrument your monitor:',
          {
            installLink: <ExternalLink href="https://docs.sentry.io/platforms/java/" />,
            configureLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/java/configuration/integrations/quartz/" />
            ),
          }
        )}
      </div>
      <CodeSnippet language="java">{code}</CodeSnippet>
    </Fragment>
  );
}

export function CeleryBeatAutoDiscovery(props: QuickStartProps) {
  const {dsnKey} = props;

  const code = `# tasks.py
from celery import signals

import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration


@signals.celeryd_init.connect
def init_sentry(**kwargs):
    sentry_sdk.init(
        dsn='${dsnKey ?? '<PROJECT DSN>'}',
        integrations=[CeleryIntegration(monitor_beat_tasks=True)],  # 👈
        environment="local.dev.grace",
        release="v1.0",
    )
  `;

  return (
    <Fragment>
      <div>
        {tct(
          'Use the [additionalDocs: Celery integration] to monitor your Celery periodic tasks. Initialize Sentry in the celeryd_init or beat_init signal.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/python/guides/celery/crons/#celery-beat-auto-discovery" />
            ),
          }
        )}
      </div>
      <div>{t('Make sure to set monitor_beat_tasks=True in CeleryIntegration:')}</div>
      <CodeSnippet language="python">{code}</CodeSnippet>
    </Fragment>
  );
}

export function PHPUpsertPlatformGuide() {
  const scheduleCode = `// Create a crontab schedule object (every 10 minutes)
$monitorSchedule = \Sentry\MonitorSchedule::crontab('*/10 * * * *');

// Or create an interval schedule object (every 10 minutes)
$monitorSchedule = \Sentry\MonitorSchedule::interval(10, MonitorScheduleUnit::minute());`;

  const upsertCode = `// Create a config object
$monitorConfig = new \Sentry\MonitorConfig(
    $monitorSchedule,
    checkinMargin: 5, // Optional check-in margin in minutes
    maxRuntime: 15, // Optional max runtime in minutes
    timezone: 'Europe/Vienna', // Optional timezone
);

// 🟡 Notify Sentry your job is running:
$checkInId = \Sentry\captureCheckIn(
    slug: '<monitor-slug>',
    status: CheckInStatus::inProgress(),
    monitorConfig: $monitorConfig,
);

// Execute your scheduled task here...

// 🟢 Notify Sentry your job has completed successfully:
\Sentry\captureCheckIn(
    slug: '<monitor-slug>',
    status: CheckInStatus::inProgress(),
    checkInId: $checkInId,
);`;

  return (
    <Fragment>
      <div>
        {tct(
          'You can use the [additionalDocs: PHP SDK] to create and update your Monitors programmatically with code rather than creating them manually.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/php/crons/#upserting-cron-monitors" />
            ),
          }
        )}
      </div>
      <CodeSnippet language="php">{scheduleCode}</CodeSnippet>
      <CodeSnippet language="php">{upsertCode}</CodeSnippet>
    </Fragment>
  );
}

export function LaravelUpsertPlatformGuide() {
  const basicConfigCode = `protected function schedule(Schedule $schedule)
{
    $schedule->command('emails:send')
        ->everyHour()
        ->sentryMonitor(); // add this line
}`;

  const advancedConfigCode = `protected function schedule(Schedule $schedule)
{
    $schedule->command('emails:send')
        ->everyHour()
        ->sentryMonitor(
            // Specify the slug of the job monitor in case of duplicate commands or if the monitor was created in the UI
            monitorSlug: null,
            // Check-in margin in minutes
            checkInMargin: 5,
            // Max runtime in minutes
            maxRuntime: 15,
            // In case you want to configure the job monitor exclusively in the UI, you can turn off sending the monitor config with the check-in.
            // Passing a monitor-slug is required in this case.
            updateMonitorConfig: false,
        )
}`;

  return (
    <Fragment>
      <div>
        {tct('Use the [additionalDocs: Laravel SDK] to monitor your scheduled task.', {
          additionalDocs: (
            <ExternalLink href="https://docs.sentry.io/platforms/php/guides/laravel/crons/#job-monitoring" />
          ),
        })}
      </div>
      <div>
        {t(
          'To set up, add the "sentryMonitor()" macro to your scheduled tasks defined in your "app/Console/Kernel.php" file:'
        )}
      </div>
      <CodeSnippet language="php">{basicConfigCode}</CodeSnippet>
      <div>
        {t(
          'By default, the Laravel SDK will infer various parameters of your scheduled task. For greater control, we expose some optional parameters on the sentryMonitor() macro.'
        )}
      </div>
      <CodeSnippet language="php">{advancedConfigCode}</CodeSnippet>
    </Fragment>
  );
}

export function NodeJsUpsertPlatformGuide() {
  const upsertCode = `const checkInId = Sentry.captureCheckIn(
  {
    monitorSlug: '<monitor-slug>',
    status: 'in_progress',
  },
  {
    schedule: { // Specify your schedule options here
      type: 'crontab',
      value: '* * * * *',
    },
    checkinMargin: 1,
    maxRuntime: 1,
    timezone: 'America/Los_Angeles',
  });

Sentry.captureCheckIn({
    checkInId,
    monitorSlug: '<monitor-slug>',
    status: 'ok',
  });
  `;

  return (
    <Fragment>
      <div>
        {tct(
          'Use the [additionalDocs:Node SDK] to create and update your Monitors programmatically with code rather than creating them manually.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/node/crons/" />
            ),
          }
        )}
      </div>
      <CodeSnippet language="javascript">{upsertCode}</CodeSnippet>
    </Fragment>
  );
}

export function GoUpsertPlatformGuide() {
  const scheduleCode = `// Create a crontab schedule object (every 10 minutes)
monitorSchedule := sentry.CrontabSchedule("*/10 * * * *")

// Or create an interval schedule object (every 10 minutes)
monitorSchedule := sentry.IntervalSchedule(10, sentry.MonitorScheduleUnitMinute)
  `;

  const upsertCode = `// Create a monitor config object
monitorConfig := &sentry.MonitorConfig{
  Schedule:      monitorSchedule,
  MaxRuntime:    2,
  CheckInMargin: 1,
}

// 🟡 Notify Sentry your job is running:
checkinId := sentry.CaptureCheckIn(
  &sentry.CheckIn{
    MonitorSlug: "<monitor-slug>",
    Status:      sentry.CheckInStatusInProgress,
  },
  monitorConfig,
)

// Execute your scheduled task here...

// 🟢 Notify Sentry your job has completed successfully:
sentry.CaptureCheckIn(
  &sentry.CheckIn{
    MonitorSlug: "<monitor-slug>",
    Status:      sentry.CheckInStatusOK,
  },
  monitorConfig,
)`;

  return (
    <Fragment>
      <div>
        {tct(
          'You can use the [additionalDocs: Go SDK] to create and update your Monitors programmatically with code rather than creating them manually.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/go/crons/#upserting-cron-monitors" />
            ),
          }
        )}
      </div>
      <CodeSnippet language="go">{scheduleCode}</CodeSnippet>
      <CodeSnippet language="go">{upsertCode}</CodeSnippet>
    </Fragment>
  );
}

export function JavaUpsertPlatformGuide() {
  const scheduleCode = `import io.sentry.MonitorSchedule;
import io.sentry.MonitorScheduleUnit;

// Create a crontab schedule object (every 10 minutes)
MonitorSchedule monitorSchedule = MonitorSchedule.crontab("*/10 * * * *");

// Or create an interval schedule object (every 10 minutes)
MonitorSchedule monitorSchedule = MonitorSchedule.interval(10, MonitorScheduleUnit.MINUTE);`;

  const upsertCode = `import io.sentry.MonitorConfig;

// Create a config object
MonitorConfig monitorConfig = new MonitorConfig(monitorSchedule);
monitorConfig.setTimezone("Europe/Vienna"); // Optional timezone
monitorConfig.setCheckinMargin(5L); // Optional check-in margin in minutes
monitorConfig.setMaxRuntime(15L); // Optional max runtime in minutes

// 🟡 Notify Sentry your job is running:
CheckIn checkIn = new CheckIn(
    "<monitor-slug>",
    CheckInStatus.IN_PROGRESS
);
checkIn.setMonitorConfig(monitorConfig);
SentryId checkInId = Sentry.captureCheckIn(checkIn);

// Execute your scheduled task here...

// 🟢 Notify Sentry your job has completed successfully:
Sentry.captureCheckIn(
    new CheckIn(
        checkInId,
        "<monitor-slug>",
        CheckInStatus.OK
    )
);`;

  return (
    <Fragment>
      <div>
        {tct(
          'You can use the [additionalDocs: Java SDK] to create and update your Monitors programmatically with code rather than creating them manually.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/java/crons/#upserting-cron-monitors" />
            ),
          }
        )}
      </div>
      <CodeSnippet language="java">{scheduleCode}</CodeSnippet>
      <CodeSnippet language="java">{upsertCode}</CodeSnippet>
    </Fragment>
  );
}
