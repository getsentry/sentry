import {Fragment} from 'react';
import merge from 'lodash/merge';

import {CodeBlock} from 'sentry/components/core/code';
import {ExternalLink} from 'sentry/components/core/link';
import {t, tct} from 'sentry/locale';

export interface QuickStartProps {
  cronsUrl?: string;
  dsnKey?: string;
  orgId?: string;
  orgSlug?: string;
  projectId?: string;
  slug?: string;
}

const VALUE_DEFAULTS = {
  cronsUrl: '<cron-api-url>',
  dsnKey: '<my-dsn-key>',
  orgId: '<my-organziation-id>',
  orgSlug: '<my-organization-slug>',
  projectId: '<my-project-id>',
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
      <CodeBlock language="python">{code}</CodeBlock>
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
      <CodeBlock language="python">{setupCode}</CodeBlock>
      <div>{t('Link your Celery task to your Monitor:')}</div>
      <CodeBlock language="python">{linkTaskCode}</CodeBlock>
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
            installLink: <ExternalLink href="https://docs.sentry.io/cli/installation/" />,
          }
        )}
      </div>
      <CodeBlock language="bash">{script}</CodeBlock>
    </Fragment>
  );
}

export function CurlCronQuickStart(props: QuickStartProps) {
  const {cronsUrl, slug} = withDefaultProps(props);

  const url = new URL(cronsUrl.replace('___MONITOR_SLUG___', slug));

  const checkInSuccessCode = `SENTRY_INGEST="${url.origin}"
SENTRY_CRONS="\${SENTRY_INGEST}${url.pathname}"

# 🟡 Notify Sentry your job is running:
curl "\${SENTRY_CRONS}?status=in_progress"

# Execute your scheduled task here...

# 🟢 Notify Sentry your job has completed successfully:
curl "\${SENTRY_CRONS}?status=ok"`;

  const checkInFailCode = `# 🔴 Notify Sentry your job has failed:
curl "\${SENTRY_CRONS}?status=error"`;

  return (
    <Fragment>
      <CodeBlock language="bash">{checkInSuccessCode}</CodeBlock>
      <div>{t('To notify Sentry if your job execution fails')}</div>
      <CodeBlock language="bash">{checkInFailCode}</CodeBlock>
    </Fragment>
  );
}

export function PHPCronQuickStart(props: QuickStartProps) {
  const {slug} = withDefaultProps(props);

  const checkInSuccessCode = `// 🟡 Notify Sentry your job is running:
$checkInId = \\Sentry\\captureCheckIn(
    slug: '${slug}',
    status: CheckInStatus::inProgress()
);

// Execute your scheduled task here...

// 🟢 Notify Sentry your job has completed successfully:
\\Sentry\\captureCheckIn(
    slug: '${slug}',
    status: CheckInStatus::ok(),
    checkInId: $checkInId,
);`;

  const checkInFailCode = `// 🔴 Notify Sentry your job has failed:
\\Sentry\\captureCheckIn(
    slug: '${slug}',
    status: CheckInStatus::error(),
    checkInId: $checkInId,
);`;

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
      <CodeBlock language="php">{checkInSuccessCode}</CodeBlock>
      <div>{t('To notify Sentry if your job execution fails')}</div>
      <CodeBlock language="php">{checkInFailCode}</CodeBlock>
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
      <CodeBlock language="php">{code}</CodeBlock>
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
            installLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/node/" />
            ),
          }
        )}
      </div>
      <CodeBlock language="javascript">{checkInSuccessCode}</CodeBlock>
      <div>{t('To notify Sentry if your job execution fails')}</div>
      <CodeBlock language="javascript">{checkInFailCode}</CodeBlock>
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
      <CodeBlock language="go">{checkInSuccessCode}</CodeBlock>
      <div>{t('To notify Sentry if your job execution fails')}</div>
      <CodeBlock language="go">{checkInFailCode}</CodeBlock>
    </Fragment>
  );
}

export function JavaCronQuickStart(props: QuickStartProps) {
  const {slug} = withDefaultProps(props);

  const checkInSuccessCode = `import io.sentry.util.CheckInUtils;

String result = CheckInUtils.withCheckIn("${slug}", () -> {
    // Execute your scheduled task here...
    return "computed result";
});`;

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
      <CodeBlock language="java">{checkInSuccessCode}</CodeBlock>
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
          '[installLink:Install and configure] the Sentry Spring Boot SDK (min v6.30.0), ensure that [org.aspectj.aspectjweaver] is present as a dependency of your project, then instrument your monitor:',
          {
            installLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/java/guides/spring-boot/" />
            ),
          }
        )}
      </div>
      <CodeBlock language="java">{code}</CodeBlock>
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
      <CodeBlock language="java">{code}</CodeBlock>
    </Fragment>
  );
}

export function RubyCronQuickStart(props: QuickStartProps) {
  const {slug} = withDefaultProps(props);

  const checkInSuccessCode = `# 🟡 Notify Sentry your job is running:
check_in_id = Sentry.capture_check_in('${slug}', :in_progress)

# Execute your scheduled task here...

# 🟢 Notify Sentry your job has completed successfully:
Sentry.capture_check_in('${slug}', :ok, check_in_id: check_in_id)`;

  const checkInFailCode = `# 🔴 Notify Sentry your job has failed:
Sentry.capture_check_in('${slug}', :error, check_in_id: check_in_id)`;

  return (
    <Fragment>
      <div>
        {tct(
          '[installLink:Install and configure] the Sentry Ruby SDK (min v5.12.0), then instrument your monitor:',
          {
            installLink: <ExternalLink href="https://docs.sentry.io/platforms/ruby/" />,
          }
        )}
      </div>
      <CodeBlock language="ruby">{checkInSuccessCode}</CodeBlock>
      <div>{t('To notify Sentry if your job execution fails')}</div>
      <CodeBlock language="ruby">{checkInFailCode}</CodeBlock>
    </Fragment>
  );
}

export function RubyRailsCronQuickStart(props: QuickStartProps) {
  const {slug} = withDefaultProps(props);

  const mixinCode = `class ExampleJob < ApplicationJob
  include Sentry::Cron::MonitorCheckIns

  # slug defaults to the job class name
  sentry_monitor_check_ins slug: '${slug}'

  def perform(*args)
    # do stuff
  end
end`;

  const customCode = `# define the monitor config with an interval
sentry_monitor_check_ins slug: '${slug}', monitor_config: Sentry::Cron::MonitorConfig.from_interval(10, :minute)

# define the monitor config with a crontab
sentry_monitor_check_ins slug: '${slug}', monitor_config: Sentry::Cron::MonitorConfig.from_crontab('*/10 * * * *')`;

  return (
    <Fragment>
      <div>
        {tct(
          '[installLink:Install and configure] the Sentry Ruby and Rails SDKs (min v5.12.0), then instrument your job with our mixin module:',
          {
            installLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/ruby/guides/rails/" />
            ),
          }
        )}
      </div>
      <CodeBlock language="ruby">{mixinCode}</CodeBlock>
      <div>{t('You can pass in optional attributes as follows:')}</div>
      <CodeBlock language="ruby">{customCode}</CodeBlock>
    </Fragment>
  );
}

export function RubySidekiqCronQuickStart(props: QuickStartProps) {
  const {slug} = withDefaultProps(props);

  const mixinCode = `class ExampleJob
  include Sidekiq::Job
  include Sentry::Cron::MonitorCheckIns

  # slug defaults to the job class name
  sentry_monitor_check_ins slug: '${slug}'

  def perform(*args)
    # do stuff
  end
end`;

  const customCode = `# define the monitor config with an interval
sentry_monitor_check_ins slug: '${slug}', monitor_config: Sentry::Cron::MonitorConfig.from_interval(10, :minute)

# define the monitor config with a crontab
sentry_monitor_check_ins slug: '${slug}', monitor_config: Sentry::Cron::MonitorConfig.from_crontab('*/10 * * * *')`;

  return (
    <Fragment>
      <div>
        {tct(
          '[installLink:Install and configure] the Sentry Ruby and Sidekiq SDKs (min v5.12.0), then instrument your job with our mixin module:',
          {
            installLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/ruby/guides/sidekiq/" />
            ),
          }
        )}
      </div>
      <CodeBlock language="ruby">{mixinCode}</CodeBlock>
      <div>{t('You can pass in optional attributes as follows:')}</div>
      <CodeBlock language="ruby">{customCode}</CodeBlock>
    </Fragment>
  );
}

export function DotNetCronQuickStart(props: QuickStartProps) {
  const {slug} = withDefaultProps(props);

  const checkInSuccessCode = `// 🟡 Notify Sentry your job is running:
var checkInId = SentrySdk.CaptureCheckIn("${slug}", CheckInStatus.InProgress);

// Execute your scheduled task here...

// 🟢 Notify Sentry your job has completed successfully:
SentrySdk.CaptureCheckIn("${slug}", CheckInStatus.Ok, checkInId);`;

  const checkInFailCode = `// 🔴 Notify Sentry your job has failed:
SentrySdk.CaptureCheckIn("${slug}", CheckInStatus.Error, checkInId);`;

  return (
    <Fragment>
      <div>
        {tct(
          '[installLink:Install and configure] the Sentry .NET SDK (min v4.2.0), then instrument your monitor:',
          {
            installLink: <ExternalLink href="https://docs.sentry.io/platforms/dotnet/" />,
          }
        )}
      </div>
      <CodeBlock language="csharp">{checkInSuccessCode}</CodeBlock>
      <div>{t('To notify Sentry if your job execution fails')}</div>
      <CodeBlock language="csharp">{checkInFailCode}</CodeBlock>
    </Fragment>
  );
}

export function DotNetHangfireCronQuickStart(props: QuickStartProps) {
  const {slug} = withDefaultProps(props);

  const code = `using Hangfire;
using Sentry.Hangfire;

// Configure Hangfire to use Sentry
GlobalConfiguration.Configuration.UseSentry();

// Enqueue the job
BackgroundJob.Enqueue<PricingUpdateWorker>(job => job.Execute());

public class PricingUpdateWorker
{
    [SentryMonitorSlug("${slug}")]
    public void Execute()
    {
        // Your job implementation here
    }
}`;

  return (
    <Fragment>
      <div>
        {tct(
          '[installLink:Install and configure] the Sentry .NET SDK, add the Sentry.Hangfire package, then instrument your monitor:',
          {
            installLink: <ExternalLink href="https://docs.sentry.io/platforms/dotnet/" />,
          }
        )}
      </div>
      <CodeBlock language="csharp">{code}</CodeBlock>
      <div>
        {tct(
          'For more examples see the [docsLink:Sentry Hangfire Cron Monitor documentation].',
          {
            docsLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/dotnet/crons/hangfire/" />
            ),
          }
        )}
      </div>
    </Fragment>
  );
}
