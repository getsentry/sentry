import {Fragment} from 'react';

import {CodeBlock} from 'sentry/components/core/code';
import {ExternalLink} from 'sentry/components/core/link';
import {t, tct} from 'sentry/locale';

export interface CronsPlatformGuide {
  Guide: React.ComponentType<any>;
  key: string;
  title: string;
}

export interface CronsPlatform {
  guides: CronsPlatformGuide[];
  label: string;
  platform: string;
}

export const platformGuides = [
  {
    platform: 'python-celery',
    label: 'Celery',
    guides: [
      {
        Guide: CeleryBeatAutoDiscovery,
        title: 'Auto-Instrument',
        key: 'upsert',
      },
    ],
  },
  {
    platform: 'php',
    label: 'PHP',
    guides: [
      {
        Guide: PHPUpsertPlatformGuide,
        title: 'Upsert',
        key: 'upsert',
      },
    ],
  },
  {
    platform: 'php-laravel',
    label: 'Laravel',
    guides: [
      {
        Guide: LaravelUpsertPlatformGuide,
        title: 'Upsert',
        key: 'upsert',
      },
    ],
  },
  {
    platform: 'python',
    label: 'Python',
    guides: [
      {
        Guide: PythonUpsertPlatformGuide,
        title: 'Upsert',
        key: 'upsert',
      },
    ],
  },
  {
    platform: 'node',
    label: 'NodeJS',
    guides: [
      {
        Guide: NodeJsUpsertPlatformGuide,
        title: 'Upsert',
        key: 'upsert',
      },
    ],
  },
  {
    platform: 'deno',
    label: 'Deno',
    guides: [
      {
        Guide: DenoUpsertPlatformGuide,
        title: 'Auto-Instrument',
        key: 'upsert',
      },
    ],
  },
  {
    platform: 'node-nestjs',
    label: 'NestJS',
    guides: [
      {
        Guide: NestJSUpsertPlatformGuide,
        title: 'Upsert',
        key: 'upsert',
      },
    ],
  },
  {
    platform: 'javascript-nextjs',
    label: 'Next.js',
    guides: [
      {
        Guide: NextJSUpsertPlatformGuide,
        title: 'Auto-Instrument',
        key: 'upsert',
      },
    ],
  },
  {
    platform: 'go',
    label: 'Go',
    guides: [
      {
        Guide: GoUpsertPlatformGuide,
        title: 'Upsert',
        key: 'upsert',
      },
    ],
  },
  {
    platform: 'java',
    label: 'Java',
    guides: [
      {
        Guide: JavaUpsertPlatformGuide,
        title: 'Upsert',
        key: 'upsert',
      },
    ],
  },
  {
    platform: 'java-spring-boot',
    label: 'Spring Boot',
    guides: [
      {
        Guide: JavaSpringBootUpsertPlatformGuide,
        title: 'Auto-Instrument',
        key: 'upsert',
      },
    ],
  },
  {
    platform: 'ruby',
    label: 'Ruby',
    guides: [
      {
        Guide: RubyUpsertPlatformGuide,
        title: 'Upsert',
        key: 'upsert',
      },
      {
        Guide: RubySidekiqMixinPlatformGuide,
        title: 'Sidekiq Mixin',
        key: 'sidekiq-mixin',
      },
    ],
  },
  {
    platform: 'ruby-rails',
    label: 'Rails',
    guides: [
      {
        Guide: RubySidekiqAutoPlatformGuide,
        title: 'Sidekiq Auto Discovery',
        key: 'rails-sidekiq',
      },
      {
        Guide: RubyActiveJobPlatformGuide,
        title: 'ActiveJob',
        key: 'rails-activejob',
      },
      {
        Guide: RubyRailsMixinPlatformGuide,
        title: 'Mixin',
        key: 'rails-mixin',
      },
    ],
  },
  {
    platform: 'elixir',
    label: 'Elixir',
    guides: [
      {
        Guide: ElixirUpsertPlatformGuide,
        title: 'Upsert',
        key: 'upsert',
      },
      {
        Guide: ElixirObanPlatformGuide,
        title: 'Oban',
        key: 'elixir-oban',
      },
      {
        Guide: ElixirQuantumPlatformGuide,
        title: 'Quantum',
        key: 'elixir-quantum',
      },
    ],
  },
  {
    platform: 'dotnet',
    label: '.NET',
    guides: [
      {
        Guide: DotNetUpsertPlatformGuide,
        title: 'Upsert',
        key: 'upsert',
      },
    ],
  },
  {
    platform: 'cli',
    label: 'Sentry CLI',
    guides: [
      {
        Guide: CLIUpsertPlatformGuide,
        title: 'Upsert',
        key: 'upsert',
      },
    ],
  },
  {
    platform: 'http',
    label: 'HTTP',
    guides: [
      {
        Guide: CurlUpsertPlatformGuide,
        title: 'Upsert',
        key: 'upsert',
      },
    ],
  },
] as const satisfies CronsPlatform[];

export type SupportedPlatform = (typeof platformGuides)[number]['platform'];
export type GuideKey = (typeof platformGuides)[number]['guides'][number]['key'];

function CeleryBeatAutoDiscovery() {
  const code = `# tasks.py
from celery import signals

import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration


@signals.celeryd_init.connect
def init_sentry(**kwargs):
    sentry_sdk.init(
        dsn='<PROJECT DSN>',
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
      <CodeBlock language="python">{code}</CodeBlock>
    </Fragment>
  );
}

function PHPUpsertPlatformGuide() {
  const scheduleCode = `// Create a crontab schedule object (every 10 minutes)
$monitorSchedule = \\Sentry\\MonitorSchedule::crontab('*/10 * * * *');

// Or create an interval schedule object (every 10 minutes)
$monitorSchedule = \\Sentry\\MonitorSchedule::interval(10, \\Sentry\\MonitorScheduleUnit::minute());`;

  const upsertCode = `// Create a config object
$monitorConfig = new \\Sentry\\MonitorConfig(
    $monitorSchedule,
    checkinMargin: 5, // Optional check-in margin in minutes
    maxRuntime: 10, // Optional max runtime in minutes
    timezone: 'Europe/Vienna', // Optional timezone
    failureIssueThreshold: 2, // Optional failure issue threshold
    recoveryThreshold: 5, // Optional recovery threshold
);

// 🟡 Notify Sentry your job is running:
$checkInId = \\Sentry\\captureCheckIn(
    slug: '<monitor-slug>',
    status: \\Sentry\\CheckInStatus::inProgress(),
    monitorConfig: $monitorConfig,
);

// Execute your scheduled task here...

// 🟢 Notify Sentry your job has completed successfully:
\\Sentry\\captureCheckIn(
    slug: '<monitor-slug>',
    status: \\Sentry\\CheckInStatus::ok(),
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
      <CodeBlock language="php">{scheduleCode}</CodeBlock>
      <CodeBlock language="php">{upsertCode}</CodeBlock>
    </Fragment>
  );
}

function LaravelUpsertPlatformGuide() {
  const basicConfigCode = `Schedule::command(SendEmailsCommand::class)
    ->everyHour()
    ->sentryMonitor(); // add this line`;

  const advancedConfigCode = `Schedule::command(SendEmailsCommand::class)
    ->everyHour()
    ->sentryMonitor(
        // Specify the slug of the job monitor in case of duplicate commands or if the monitor was created in the UI
        monitorSlug: null,
        // Number of minutes before a check-in is considered missed
        checkInMargin: 5,
        // Number of minutes before an in-progress check-in is marked timed out
        maxRuntime: 10,
        // Create a new issue when this many consecutive missed or error check-ins are processed
        failureIssueThreshold: 1,
        // Resolve the issue when this many consecutive healthy check-ins are processed
        recoveryThreshold: 1,
        // In case you want to configure the job monitor exclusively in the UI, you can turn off sending the monitor config with the check-in.
        // Passing a monitor-slug is required in this case.
        updateMonitorConfig: false,
    )`;

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
        {tct(
          'To set up, add the [sentryMonitor:sentryMonitor()] macro to your scheduled tasks defined in your [consoleFile:routes/console.php] file (Laravel 11+):',
          {
            sentryMonitor: <code />,
            consoleFile: <code />,
          }
        )}
      </div>
      <CodeBlock language="php">{basicConfigCode}</CodeBlock>
      <div>
        {tct(
          'For older Laravel versions or more configuration options, see the [docsLink:Laravel Crons documentation].',
          {
            docsLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/php/guides/laravel/crons/#job-monitoring" />
            ),
          }
        )}
      </div>
      <div>
        {tct(
          'By default, the Laravel SDK will infer various parameters of your scheduled task. For greater control, we expose some optional parameters on the [sentryMonitor:sentryMonitor()] macro:',
          {
            sentryMonitor: <code />,
          }
        )}
      </div>
      <CodeBlock language="php">{advancedConfigCode}</CodeBlock>
    </Fragment>
  );
}

function PythonUpsertPlatformGuide() {
  const configCode = `# All keys except 'schedule' are optional
monitor_config = {
    "schedule": {"type": "crontab", "value": "*/10 * * * *"},
    "timezone": "Europe/Vienna",
    # If an expected check-in doesn't come in 'checkin_margin'
    # minutes, it'll be considered missed
    "checkin_margin": 5,
    # The check-in is allowed to run for 'max_runtime' minutes
    # before it's considered failed
    "max_runtime": 10,
    # It'll take 'failure_issue_threshold' consecutive failed
    # check-ins to create an issue
    "failure_issue_threshold": 5,
    # It'll take 'recovery_threshold' OK check-ins to resolve
    # an issue
    "recovery_threshold": 5,
}`;

  const decoratorCode = `from sentry_sdk.crons import monitor

@monitor(monitor_slug='<monitor-slug>', monitor_config=monitor_config)
def tell_the_world():
    print('My scheduled task...')`;

  const manualCheckInCode = `from sentry_sdk.crons import capture_checkin
from sentry_sdk.crons.consts import MonitorStatus

check_in_id = capture_checkin(
    monitor_slug='<monitor-slug>',
    status=MonitorStatus.IN_PROGRESS,
    monitor_config=monitor_config,
)

# Execute your scheduled task here...

capture_checkin(
    monitor_slug='<monitor-slug>',
    check_in_id=check_in_id,
    status=MonitorStatus.OK,
)`;

  return (
    <Fragment>
      <div>
        {tct(
          'You can use the [additionalDocs: Python SDK] (min v1.45.0) to create and update your Monitors programmatically with code rather than creating them manually.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/python/crons/" />
            ),
          }
        )}
      </div>
      <div>{t('Define your monitor configuration:')}</div>
      <CodeBlock language="python">{configCode}</CodeBlock>
      <div>{t('Use the monitor decorator with your configuration:')}</div>
      <CodeBlock language="python">{decoratorCode}</CodeBlock>
      <div>{t('Or use manual check-ins:')}</div>
      <CodeBlock language="python">{manualCheckInCode}</CodeBlock>
    </Fragment>
  );
}

function NodeJsUpsertPlatformGuide() {
  const withMonitorCode = `const monitorConfig = {
  schedule: {
    type: "crontab",
    value: "*/10 * * * *",
  },
  checkinMargin: 5, // In minutes. Optional.
  maxRuntime: 10, // In minutes. Optional.
  timezone: "America/Los_Angeles", // Optional.
};

Sentry.withMonitor(
  "<monitor-slug>",
  () => {
    // Execute your scheduled task here...
  },
  monitorConfig
);`;

  const upsertCode = `const monitorConfig = {
  schedule: {
    type: "crontab",
    value: "*/10 * * * *",
  },
  checkinMargin: 5, // In minutes. Optional.
  maxRuntime: 10, // In minutes. Optional.
  timezone: "America/Los_Angeles", // Optional.
};

// 🟡 Notify Sentry your job is running:
const checkInId = Sentry.captureCheckIn(
  {
    monitorSlug: '<monitor-slug>',
    status: 'in_progress',
  },
  monitorConfig
);

// Execute your scheduled task here...

// 🟢 Notify Sentry your job has completed successfully:
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
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/crons/" />
            ),
          }
        )}
      </div>
      <div>
        {tct('Use [withMonitor:Sentry.withMonitor()] to wrap your job:', {
          withMonitor: <code />,
        })}
      </div>
      <CodeBlock language="javascript">{withMonitorCode}</CodeBlock>
      <div>{t('Alternatively, use manual check-ins:')}</div>
      <CodeBlock language="javascript">{upsertCode}</CodeBlock>
    </Fragment>
  );
}

function DenoUpsertPlatformGuide() {
  const setupCode = `import * as Sentry from "npm:@sentry/deno";

Sentry.init({
  dsn: '<PROJECT DSN>',
  integrations: [Sentry.denoCronIntegration()],
});`;

  const cronCode = `Deno.cron("my-cron-job", "* * * * *", async () => {
  // Your cron job logic here
  console.log("Running scheduled task...");

  // Example: Fetch data or perform some operation
  await performTask();
});`;

  return (
    <Fragment>
      <div>
        {tct(
          'Use the [additionalDocs:Deno SDK] with [denoCronIntegration:denoCronIntegration()] to automatically instrument [denoCron:Deno.cron()] jobs.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/deno/crons/" />
            ),
            denoCronIntegration: <code />,
            denoCron: <code />,
          }
        )}
      </div>
      <div>{t('Initialize Sentry with the denoCronIntegration:')}</div>
      <CodeBlock language="typescript">{setupCode}</CodeBlock>
      <div>{t('Define your Deno.cron() jobs as usual:')}</div>
      <CodeBlock language="typescript">{cronCode}</CodeBlock>
      <div>
        {t(
          'Monitors will be automatically created and check-ins will be sent for each Deno.cron() job.'
        )}
      </div>
    </Fragment>
  );
}

function NestJSUpsertPlatformGuide() {
  const code = `import { Cron } from '@nestjs/schedule';
import { SentryCron } from '@sentry/nestjs';

export class MyCronService {
  @Cron('*/10 * * * *')
  @SentryCron('<monitor-slug>', {
    schedule: {
      type: "crontab",
      value: "*/10 * * * *",
    },
    checkinMargin: 5, // In minutes
    maxRuntime: 10, // In minutes
    timezone: "America/Los_Angeles",
  })
  handleCron() {
    // Your cron job logic here
  }
}`;

  return (
    <Fragment>
      <div>
        {tct(
          'Use the [additionalDocs:NestJS SDK] (min v8.16.0) with the [sentryCron:@SentryCron] decorator to automatically instrument your scheduled tasks and upsert monitors.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nestjs/features/sentry-cron-decorator/" />
            ),
            sentryCron: <code />,
          }
        )}
      </div>
      <div>{t('Apply the @SentryCron decorator after the @Cron decorator:')}</div>
      <CodeBlock language="typescript">{code}</CodeBlock>
    </Fragment>
  );
}

function NextJSUpsertPlatformGuide() {
  const configCode = `// next.config.js
const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig(
  {
    // Your Next.js config
  },
  {
    automaticVercelMonitors: true, // Enable Vercel Cron Jobs monitoring
    // ... other Sentry options
  }
);`;

  const cronCode = `// Example Vercel Cron Job in vercel.json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 * * * *"
    }
  ]
}`;

  return (
    <Fragment>
      <div>
        {tct(
          'Use the [additionalDocs:Next.js SDK] with [automaticVercelMonitors:automaticVercelMonitors] to automatically create monitors for your Vercel Cron Jobs.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/build/" />
            ),
            automaticVercelMonitors: <code />,
          }
        )}
      </div>
      <div>{t('Enable automaticVercelMonitors in your next.config.js:')}</div>
      <CodeBlock language="javascript">{configCode}</CodeBlock>
      <div>{t('Configure your Vercel Cron Jobs in vercel.json:')}</div>
      <CodeBlock language="json">{cronCode}</CodeBlock>
      <div>
        {t(
          'Monitors will be automatically created for each cron job in your vercel.json configuration.'
        )}
      </div>
    </Fragment>
  );
}

function GoUpsertPlatformGuide() {
  const scheduleCode = `// Create a crontab schedule object (every 10 minutes)
monitorSchedule := sentry.CrontabSchedule("*/10 * * * *")

// Or create an interval schedule object (every 10 minutes)
monitorSchedule := sentry.IntervalSchedule(10, sentry.MonitorScheduleUnitMinute)
  `;

  const upsertCode = `// Create a monitor config object
monitorConfig := &sentry.MonitorConfig{
  Schedule:      monitorSchedule,
  MaxRuntime:    10,
  CheckInMargin: 5,
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
    ID:          *checkinId,
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
      <CodeBlock language="go">{scheduleCode}</CodeBlock>
      <CodeBlock language="go">{upsertCode}</CodeBlock>
    </Fragment>
  );
}

function JavaUpsertPlatformGuide() {
  const scheduleCode = `import io.sentry.MonitorSchedule;
import io.sentry.MonitorScheduleUnit;

// Create a crontab schedule object (every 10 minutes)
MonitorSchedule monitorSchedule = MonitorSchedule.crontab("*/10 * * * *");

// Or create an interval schedule object (every 10 minutes)
MonitorSchedule monitorSchedule = MonitorSchedule.interval(10, MonitorScheduleUnit.MINUTE);`;

  const upsertCode = `import io.sentry.MonitorConfig;
import io.sentry.util.CheckInUtils;

// Create a config object
MonitorConfig monitorConfig = new MonitorConfig(monitorSchedule);
monitorConfig.setTimezone("Europe/Vienna"); // Optional timezone
monitorConfig.setCheckinMargin(5L); // Optional check-in margin in minutes
monitorConfig.setMaxRuntime(10L); // Optional max runtime in minutes

String result = CheckInUtils.withCheckIn("<monitor-slug>", monitorConfig, () -> {
    // Execute your scheduled task here...
    return "computed result";
});`;

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
      <CodeBlock language="java">{scheduleCode}</CodeBlock>
      <CodeBlock language="java">{upsertCode}</CodeBlock>
    </Fragment>
  );
}

function JavaSpringBootUpsertPlatformGuide() {
  const code = `import io.sentry.spring.jakarta.checkin.SentryCheckIn;

@Component
public class CustomJob {

  @Scheduled(fixedRate = 3 * 60 * 1000L)
  @SentryCheckIn("<monitor-slug>") // 👈
  void execute() throws InterruptedException {
    // your task code
  }
}`;

  return (
    <Fragment>
      <div>
        {tct(
          'Use the [additionalDocs: Spring Boot SDK] (min v6.30.0) with the [sentryCheckIn:@SentryCheckIn] annotation to automatically instrument your scheduled tasks.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/java/guides/spring-boot/crons/" />
            ),
            sentryCheckIn: <code />,
          }
        )}
      </div>
      <div>
        {t(
          'Ensure that org.aspectj:aspectjweaver is present as a dependency of your project.'
        )}
      </div>
      <CodeBlock language="java">{code}</CodeBlock>
      <div>
        {t(
          'The @SentryCheckIn annotation automatically creates check-ins for your @Scheduled methods.'
        )}
      </div>
    </Fragment>
  );
}

function RubyUpsertPlatformGuide() {
  const configCode = `# Create a config from a crontab schedule (every 10 minutes)
monitor_config = Sentry::Cron::MonitorConfig.from_crontab(
  '*/10 * * * *',
  checkin_margin: 5, # Optional check-in margin in minutes
  max_runtime: 10, # Optional max runtime in minutes
  timezone: 'Europe/Vienna', # Optional timezone
)

# Create a config from an interval schedule (every 10 minutes)
monitor_config = Sentry::Cron::MonitorConfig.from_interval(
  10,
  :minute,
  checkin_margin: 5, # Optional check-in margin in minutes
  max_runtime: 10, # Optional max runtime in minutes
  timezone: 'Europe/Vienna', # Optional timezone
)`;

  const upsertCode = `# 🟡 Notify Sentry your job is running:
check_in_id = Sentry.capture_check_in(
  '<monitor-slug>',
  :in_progress,
  monitor_config: monitor_config
)

# Execute your scheduled task here...

# 🟢 Notify Sentry your job has completed successfully:
Sentry.capture_check_in(
  '<monitor-slug>',
  :ok,
  check_in_id: check_in_id,
  monitor_config: monitor_config
)`;

  return (
    <Fragment>
      <div>
        {tct(
          'You can use the [additionalDocs: Ruby SDK] to create and update your Monitors programmatically with code rather than creating them manually.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/ruby/crons/#upserting-cron-monitors" />
            ),
          }
        )}
      </div>
      <CodeBlock language="ruby">{configCode}</CodeBlock>
      <CodeBlock language="ruby">{upsertCode}</CodeBlock>
    </Fragment>
  );
}

function RubySidekiqAutoPlatformGuide() {
  const sidekiqCronCode = `Sentry.init do |config|
  # for sidekiq-cron
  config.enabled_patches += [:sidekiq_cron]

  # for sidekiq-scheduler
  config.enabled_patches += [:sidekiq_scheduler]
end`;

  return (
    <Fragment>
      <div>
        {tct(
          'If you use gems such as [sidekiqCronLink:sidekiq-cron] or [sidekiqSchedulerLink:sidekiq-scheduler] to manage your scheduled jobs, Sentry can automatically monitor all of them for you without any additional configuration.',
          {
            sidekiqCronLink: (
              <ExternalLink href="https://github.com/sidekiq-cron/sidekiq-cron" />
            ),
            sidekiqSchedulerLink: (
              <ExternalLink href="https://github.com/sidekiq-scheduler/sidekiq-scheduler" />
            ),
          }
        )}
      </div>
      <div>
        {tct(
          '[installLink:Install and configure] the Sentry Ruby and Sidekiq SDKs (min v5.14.0) and turn on the relevant patches:',
          {
            installLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/ruby/guides/sidekiq/" />
            ),
          }
        )}
      </div>
      <CodeBlock language="ruby">{sidekiqCronCode}</CodeBlock>
    </Fragment>
  );
}

function RubySidekiqMixinPlatformGuide() {
  const configCode = `# Create monitor config with an interval
monitor_config = Sentry::Cron::MonitorConfig.from_interval(
  10,
  :minute,
  checkin_margin: 5,
  max_runtime: 10,
  timezone: 'Europe/Vienna'
)

# Or create monitor config with a crontab
monitor_config = Sentry::Cron::MonitorConfig.from_crontab(
  '*/10 * * * *',
  checkin_margin: 5,
  max_runtime: 10,
  timezone: 'Europe/Vienna'
)`;

  const code = `class ExampleJob
  include Sidekiq::Job
  include Sentry::Cron::MonitorCheckIns

  # Pass monitor_config to upsert the monitor
  sentry_monitor_check_ins(
    slug: '<monitor-slug>',
    monitor_config: Sentry::Cron::MonitorConfig.from_crontab('*/10 * * * *')
  )

  def perform(*args)
    # do stuff
  end
end`;

  return (
    <Fragment>
      <div>
        {tct(
          'Use the [additionalDocs: Ruby SDK] (min v5.12.0) with the [monitorCheckIns:Sentry::Cron::MonitorCheckIns] mixin to automatically capture check-ins from your Sidekiq jobs and upsert the monitor.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/ruby/crons/#job-monitoring" />
            ),
            monitorCheckIns: <code />,
          }
        )}
      </div>
      <div>{t('Define your monitor configuration:')}</div>
      <CodeBlock language="ruby">{configCode}</CodeBlock>
      <div>{t('Use the mixin in your job class:')}</div>
      <CodeBlock language="ruby">{code}</CodeBlock>
    </Fragment>
  );
}

function RubyRailsMixinPlatformGuide() {
  const activeJobCode = `class ExampleActiveJob < ApplicationJob
  include Sentry::Cron::MonitorCheckIns

  # slug defaults to the job class name if not provided
  sentry_monitor_check_ins slug: 'custom', monitor_config: Sentry::Cron::MonitorConfig.from_crontab('*/10 * * * *')

  def perform(*args)
    # do stuff
  end
end`;

  const sidekiqJobCode = `class ExampleSidekiqJob
  include Sidekiq::Job
  include Sentry::Cron::MonitorCheckIns

  # slug defaults to the job class name if not provided
  sentry_monitor_check_ins slug: 'custom', monitor_config: Sentry::Cron::MonitorConfig.from_crontab('*/10 * * * *')

  def perform(*args)
    # do stuff
  end
end`;

  const customCode = `# define the monitor config with an interval
sentry_monitor_check_ins slug: 'custom', monitor_config: Sentry::Cron::MonitorConfig.from_interval(10, :minute)

# define the monitor config with a crontab
sentry_monitor_check_ins slug: 'custom', monitor_config: Sentry::Cron::MonitorConfig.from_crontab('*/10 * * * *')`;

  return (
    <Fragment>
      <div>
        {tct(
          'You can use the mixin module from the [additionalDocs: Ruby SDK] to automatically capture check-ins from your jobs rather than creating them manually.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/ruby/crons/#job-monitoring" />
            ),
          }
        )}
      </div>
      <div>{t('ActiveJob Example:')}</div>
      <CodeBlock language="ruby">{activeJobCode}</CodeBlock>
      <div>{t('Sidekiq Example:')}</div>
      <CodeBlock language="ruby">{sidekiqJobCode}</CodeBlock>
      <div>
        {t(
          'You can define the monitor config with an interval or crontab schedule to automatically upsert your monitor:'
        )}
      </div>
      <CodeBlock language="ruby">{customCode}</CodeBlock>
    </Fragment>
  );
}

function RubyActiveJobPlatformGuide() {
  const configCode = `# Create monitor config with an interval
monitor_config = Sentry::Cron::MonitorConfig.from_interval(
  10,
  :minute,
  checkin_margin: 5,
  max_runtime: 10,
  timezone: 'Europe/Vienna'
)

# Or create monitor config with a crontab
monitor_config = Sentry::Cron::MonitorConfig.from_crontab(
  '*/10 * * * *',
  checkin_margin: 5,
  max_runtime: 10,
  timezone: 'Europe/Vienna'
)`;

  const code = `class ExampleJob < ApplicationJob
  include Sentry::Cron::MonitorCheckIns

  # Pass monitor_config to upsert the monitor
  sentry_monitor_check_ins(
    slug: '<monitor-slug>',
    monitor_config: Sentry::Cron::MonitorConfig.from_crontab('*/10 * * * *')
  )

  def perform(*args)
    # do stuff
  end
end`;

  return (
    <Fragment>
      <div>
        {tct(
          'Use the [additionalDocs: Ruby SDK] (min v5.12.0) with the [monitorCheckIns:Sentry::Cron::MonitorCheckIns] mixin to automatically capture check-ins from your ActiveJob jobs and upsert the monitor.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/ruby/crons/#job-monitoring" />
            ),
            monitorCheckIns: <code />,
          }
        )}
      </div>
      <div>{t('Define your monitor configuration:')}</div>
      <CodeBlock language="ruby">{configCode}</CodeBlock>
      <div>{t('Use the mixin in your job class:')}</div>
      <CodeBlock language="ruby">{code}</CodeBlock>
    </Fragment>
  );
}

function ElixirUpsertPlatformGuide() {
  const configCode = `# Create a config from a crontab schedule (every 10 minutes)
monitor_config = [
  schedule: [
    type: :crontab,
    value: "*/10 * * * *",
  ],
  checkin_margin: 5, # Optional check-in margin in minutes
  max_runtime: 10, # Optional max runtime in minutes
  timezone: "Europe/Vienna", # Optional timezone
]

# Alternatively, create a config from an interval schedule (every 10 minutes in this case):
monitor_config = [
  schedule: [
    type: :interval,
    unit: :minute,
    value: 10
  ],
  checkin_margin: 5, # Optional check-in margin in minutes
  max_runtime: 10, # Optional max runtime in minutes
  timezone: "Europe/Vienna", # Optional timezone
]`;

  const upsertCode = `# Notify Sentry your job is running:
{:ok, check_in_id} =
  Sentry.capture_check_in(
    status: :in_progress,
    monitor_slug: "<monitor-slug>",
    monitor_config: monitor_config
  )

# Execute your job:
execute_job()

# Notify Sentry your job has completed successfully:
Sentry.capture_check_in(
  status: :ok,
  check_in_id: check_in_id,
  monitor_slug: "<monitor-slug>",
  monitor_config: monitor_config
)`;

  return (
    <Fragment>
      <div>
        {tct(
          'You can use the [additionalDocs:Elixir SDK] to create and update your Monitors programmatically with code rather than creating them manually.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/elixir/crons/#upserting-cron-monitors" />
            ),
          }
        )}
      </div>
      <div>{t('Define your monitor configuration:')}</div>
      <CodeBlock language="elixir">{configCode}</CodeBlock>
      <div>{t('Use manual check-ins with your configuration:')}</div>
      <CodeBlock language="elixir">{upsertCode}</CodeBlock>
    </Fragment>
  );
}

function ElixirObanPlatformGuide() {
  const code = `config :sentry,
  integrations: [
    oban: [cron: [enabled: true]]  # 👈
  ]`;

  return (
    <Fragment>
      <div>
        {tct(
          'Use the [additionalDocs:Elixir SDK] with the [oban:Oban integration] to automatically capture check-ins for all scheduled Oban jobs.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/elixir/crons/" />
            ),
            oban: <code />,
          }
        )}
      </div>
      <div>{t('Enable the Oban cron integration in your config:')}</div>
      <CodeBlock language="elixir">{code}</CodeBlock>
      <div>
        {t(
          'Monitors will be automatically created for all Oban cron jobs configured in your application.'
        )}
      </div>
    </Fragment>
  );
}

function ElixirQuantumPlatformGuide() {
  const code = `config :sentry,
  integrations: [
    quantum: [cron: [enabled: true]]  # 👈
  ]`;

  return (
    <Fragment>
      <div>
        {tct(
          'Use the [additionalDocs:Elixir SDK] with the [quantum:Quantum integration] to automatically capture check-ins for all scheduled Quantum jobs.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/elixir/crons/" />
            ),
            quantum: <code />,
          }
        )}
      </div>
      <div>{t('Enable the Quantum cron integration in your config:')}</div>
      <CodeBlock language="elixir">{code}</CodeBlock>
      <div>
        {t(
          'Monitors will be automatically created for all Quantum cron jobs configured in your application.'
        )}
      </div>
    </Fragment>
  );
}

function DotNetUpsertPlatformGuide() {
  const scheduleCode = `// Create a crontab schedule (every 10 minutes)
SentrySdk.CaptureCheckIn(
    "<monitor-slug>",
    CheckInStatus.InProgress,
    configureMonitorOptions: options =>
    {
        options.Interval("*/10 * * * *");
        options.CheckInMargin = TimeSpan.FromMinutes(5);
        options.MaxRuntime = TimeSpan.FromMinutes(10);
        options.TimeZone = "Europe/Vienna";
    });

// Create an interval schedule (every 10 minutes)
SentrySdk.CaptureCheckIn(
    "<monitor-slug>",
    CheckInStatus.InProgress,
    configureMonitorOptions: options =>
    {
        options.Interval(10, SentryMonitorInterval.Minute);
        options.CheckInMargin = TimeSpan.FromMinutes(5);
        options.MaxRuntime = TimeSpan.FromMinutes(10);
        options.TimeZone = "Europe/Vienna";
    });`;

  const upsertCode = `// 🟡 Notify Sentry your job is running:
var checkInId = SentrySdk.CaptureCheckIn(
    "<monitor-slug>",
    CheckInStatus.InProgress,
    configureMonitorOptions: options =>
    {
        options.Interval("*/10 * * * *");
        options.CheckInMargin = TimeSpan.FromMinutes(5);
        options.MaxRuntime = TimeSpan.FromMinutes(10);
        options.TimeZone = "Europe/Vienna";
    });

// Execute your scheduled task here...

// 🟢 Notify Sentry your job has completed successfully:
SentrySdk.CaptureCheckIn("<monitor-slug>", CheckInStatus.Ok, checkInId);`;

  return (
    <Fragment>
      <div>
        {tct(
          'You can use the [additionalDocs:.NET SDK] to create and update your Monitors programmatically with code rather than creating them manually.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/platforms/dotnet/crons/" />
            ),
          }
        )}
      </div>
      <CodeBlock language="csharp">{scheduleCode}</CodeBlock>
      <CodeBlock language="csharp">{upsertCode}</CodeBlock>
    </Fragment>
  );
}

function CLIUpsertPlatformGuide() {
  const upsertCode = `# Upsert a monitor with a crontab schedule (every 10 minutes)
sentry-cli monitors run \\
  --schedule "*/10 * * * *" \\
  --check-in-margin 5 \\
  --max-runtime 10 \\
  --timezone "Europe/Vienna" \\
  <monitor-slug> \\
  -- <command> <args>`;

  const exampleCode = `# Example: Python script with monitor upsert
sentry-cli monitors run \\
  --schedule "*/10 * * * *" \\
  --check-in-margin 5 \\
  --max-runtime 10 \\
  my-monitor-slug \\
  -- python path/to/file.py

# Example: Node.js script with monitor upsert
sentry-cli monitors run \\
  --schedule "*/10 * * * *" \\
  --check-in-margin 5 \\
  --max-runtime 10 \\
  my-monitor-slug \\
  -- node path/to/file.js`;

  return (
    <Fragment>
      <div>
        {tct(
          'You can use the [additionalDocs:Sentry CLI] (min v2.16.1) to create and update your Monitors programmatically when running your job.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/cli/crons/#creating-or-updating-a-monitor-through-a-check-in-optional" />
            ),
          }
        )}
      </div>
      <div>
        {tct(
          'Use the [schedule:--schedule] argument to provide the cron schedule, along with optional [checkinMargin:--check-in-margin], [maxRuntime:--max-runtime], and [timezone:--timezone] arguments:',
          {
            schedule: <code />,
            checkinMargin: <code />,
            maxRuntime: <code />,
            timezone: <code />,
          }
        )}
      </div>
      <CodeBlock language="bash">{upsertCode}</CodeBlock>
      <div>{t('Usage examples:')}</div>
      <CodeBlock language="bash">{exampleCode}</CodeBlock>
    </Fragment>
  );
}

function CurlUpsertPlatformGuide() {
  const upsertCode = `SENTRY_INGEST="https://<ingest-domain>"
SENTRY_CRONS="\${SENTRY_INGEST}/api/<project-id>/cron/<monitor-slug>/<dsn-public-key>/"

# 🟡 Notify Sentry your job is running with monitor config:
curl -X POST "\${SENTRY_CRONS}" \\
    --header 'Content-Type: application/json' \\
    --data-raw '{
      "monitor_config": {
        "schedule": {"type": "crontab", "value": "*/10 * * * *"},
        "checkin_margin": 5,
        "max_runtime": 10,
        "timezone": "America/Los_Angeles",
        "failure_issue_threshold": 1,
        "recovery_threshold": 1
      },
      "status": "in_progress"
    }'

# Execute your scheduled task here...

# 🟢 Notify Sentry your job has completed successfully:
curl "\${SENTRY_CRONS}?status=ok"`;

  const intervalExample = `# Alternatively, use an interval schedule (every 10 minutes):
curl -X POST "\${SENTRY_CRONS}" \\
    --header 'Content-Type: application/json' \\
    --data-raw '{
      "monitor_config": {
        "schedule": {"type": "interval", "value": 10, "unit": "minute"},
        "checkin_margin": 5,
        "max_runtime": 10,
        "timezone": "America/Los_Angeles"
      },
      "status": "in_progress"
    }'`;

  return (
    <Fragment>
      <div>
        {tct(
          'You can use the [additionalDocs:Sentry HTTP API] to create and update your Monitors programmatically through check-ins.',
          {
            additionalDocs: (
              <ExternalLink href="https://docs.sentry.io/product/crons/getting-started/http/#creating-or-updating-a-monitor-through-a-check-in-optional" />
            ),
          }
        )}
      </div>
      <div>
        {tct(
          'Send a POST request with [monitorConfig:monitor_config] in the JSON payload:',
          {
            monitorConfig: <code />,
          }
        )}
      </div>
      <CodeBlock language="bash">{upsertCode}</CodeBlock>
      <div>{t('You can also use an interval schedule:')}</div>
      <CodeBlock language="bash">{intervalExample}</CodeBlock>
    </Fragment>
  );
}
