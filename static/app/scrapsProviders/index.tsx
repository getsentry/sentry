import {ToastProvider} from '@sentry/scraps/toast';
import {TranslationContextProvider} from '@sentry/scraps/translation';

import {t, tct} from 'sentry/locale';
import {SentryPaginationProvider} from 'sentry/scrapsProviders/pagination';

import {SentryDateTimeProvider} from './datetime';
import {SentryFormErrorProvider} from './formError';
import {SentryLinkBehaviorProvider} from './link';
import {SentryOverlayProvider} from './overlay';

const sentryTranslation = {t, tct};

export function ScrapsProviders({children}: {children: React.ReactNode}) {
  return (
    <SentryFormErrorProvider>
      <TranslationContextProvider value={sentryTranslation}>
        <SentryDateTimeProvider>
          <SentryPaginationProvider>
            <SentryLinkBehaviorProvider>
              <SentryOverlayProvider>
                <ToastProvider>{children}</ToastProvider>
              </SentryOverlayProvider>
            </SentryLinkBehaviorProvider>
          </SentryPaginationProvider>
        </SentryDateTimeProvider>
      </TranslationContextProvider>
    </SentryFormErrorProvider>
  );
}
