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

  const code = `from sentry_sdk.crons import monitor

# Add this decorator to instrument your python function
@monitor(monitor_slug='${slug}')
def tell_the_world(msg):
  print(msg)`;

  return <CodeSnippet language="python">{code}</CodeSnippet>;
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
          'Make sure to [installLink:install the Sentry CLI] first, then instrument your job like so',
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
