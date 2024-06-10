import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconClose} from 'sentry/icons/iconClose';
import {t, tct} from 'sentry/locale';
import useDismissAlert from 'sentry/utils/useDismissAlert';

const LOCAL_STORAGE_KEY = 'custom-metrics-sdk-api-change-alert-dismissed';

export function MetricsApiChangeAlert() {
  const {isDismissed, dismiss} = useDismissAlert({
    key: LOCAL_STORAGE_KEY,
  });

  if (isDismissed) {
    return null;
  }

  return (
    <Alert
      type="warning"
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
      {tct(
        'There are upcoming changes to the Metrics API that may affect your usage. Read the [link:FAQs] for more details.',
        {
          link: (
            <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/26369339769883-Upcoming-API-Changes-to-Metrics" />
          ),
        }
      )}
    </Alert>
  );
}
