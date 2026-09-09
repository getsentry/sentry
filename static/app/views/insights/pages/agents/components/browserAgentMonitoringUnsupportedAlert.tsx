import {Alert} from '@sentry/scraps/alert';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

export function BrowserAgentMonitoringUnsupportedAlert({
  projectSlug,
}: {
  projectSlug: string;
}) {
  const docsLink = (
    <ExternalLink href="https://docs.sentry.io/platforms/javascript/tracing/instrumentation/ai-agents-module-browser/#manual-span-creation" />
  );
  return (
    <Alert variant="info" icon={<IconInfo />}>
      <Text bold>
        {t("Automatic Agent Monitoring isn't available for %s.", projectSlug)}
      </Text>{' '}
      {tct('For browser projects, see our [docsLink:manual AI instrumentation guide].', {
        docsLink,
      })}
    </Alert>
  );
}
