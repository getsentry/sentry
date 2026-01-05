import {parseAsBoolean, useQueryState} from 'nuqs';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

export function AlertsRedirectNotice({children}: {children: React.ReactNode}) {
  const [wasRedirectedFromAlerts, setWasRedirectedFromAlerts] = useQueryState(
    'alertsRedirect',
    parseAsBoolean.withOptions({history: 'replace'}).withDefault(false)
  );

  if (!wasRedirectedFromAlerts) {
    return null;
  }

  return (
    <Alert
      variant="info"
      trailingItems={
        <Button
          size="zero"
          borderless
          icon={<IconClose />}
          aria-label={t('Dismiss')}
          onClick={() => {
            setWasRedirectedFromAlerts(false);
          }}
        />
      }
    >
      {children}
    </Alert>
  );
}
