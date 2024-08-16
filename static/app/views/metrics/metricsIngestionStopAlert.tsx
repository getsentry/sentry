import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconClose} from 'sentry/icons/iconClose';
import {t, tct} from 'sentry/locale';
import useDismissAlert from 'sentry/utils/useDismissAlert';

const LOCAL_STORAGE_KEY = 'custom-metrics-stop-being-ingested-alert-dismissed';

export function MetricsStopIngestionAlert() {
  const {dismiss, isDismissed} = useDismissAlert({
    key: LOCAL_STORAGE_KEY,
    expirationDays: 14, // 2 weeks
  });

  if (isDismissed) {
    return null;
  }

  return (
    <Alert
      type="error"
      showIcon
      trailingItems={
        <Button
          aria-label={t('Dismiss banner')}
          icon={<IconClose />}
          onClick={dismiss}
          size="zero"
          borderless
        />
      }
    >
      {
        // the exact date will be provided later
        tct(
          "We've released a new API to submit metrics. Metrics using with the old API will stop being ingested soon. Read the [link:FAQs] for more details.",
          {
            link: (
              <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/26369339769883-Upcoming-API-Changes-to-Metrics" />
            ),
          }
        )
      }
    </Alert>
  );
}
