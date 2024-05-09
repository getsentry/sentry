import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

export function TraceUXChangeAlert() {
  const [dismiss, setDismissed] = useLocalStorageState('trace-view-dismissed', false);
  if (dismiss) {
    return null;
  }

  return (
    <Alert
      type="info"
      system
      trailingItems={
        <Button
          aria-label={t('dismiss')}
          priority="link"
          size="xs"
          icon={<IconClose />}
          onClick={() => setDismissed(true)}
        />
      }
    >
      {tct(
        'Get deeper context with the new trace view, which links events directly inside traces. Read [why] we are doing this and how it helps you',
        {
          why: (
            <a href="https://docs.sentry.io/product/sentry-basics/concepts/tracing/trace-view/">
              {t('why')}
            </a>
          ),
        }
      )}
    </Alert>
  );
}
