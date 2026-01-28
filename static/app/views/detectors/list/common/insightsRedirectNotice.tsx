import {parseAsBoolean, useQueryState} from 'nuqs';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

export function InsightsRedirectNotice({children}: {children: React.ReactNode}) {
  const [wasRedirectedFromInsights, setWasRedirectedFromInsights] = useQueryState(
    'insightsRedirect',
    parseAsBoolean.withOptions({history: 'replace'}).withDefault(false)
  );

  if (!wasRedirectedFromInsights) {
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
            setWasRedirectedFromInsights(false);
          }}
        />
      }
    >
      {children}
    </Alert>
  );
}
