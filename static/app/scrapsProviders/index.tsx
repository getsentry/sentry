import {ToastProvider} from '@sentry/scraps/toast';
import {TranslationContextProvider} from '@sentry/scraps/translation';

import {t, tct} from 'sentry/locale';

import {SentryFormErrorProvider} from './formError';
import {SentryLinkBehaviorProvider} from './link';
import {SentryOverlayProvider} from './overlay';
import {SentryPaginationProvider} from './pagination';

const sentryTranslation = {t, tct};

export function ScrapsProviders({children}: {children: React.ReactNode}) {
  return (
    <SentryFormErrorProvider>
      <TranslationContextProvider value={sentryTranslation}>
        <SentryPaginationProvider>
          <SentryLinkBehaviorProvider>
            <SentryOverlayProvider>
              <ToastProvider>{children}</ToastProvider>
            </SentryOverlayProvider>
          </SentryLinkBehaviorProvider>
        </SentryPaginationProvider>
      </TranslationContextProvider>
    </SentryFormErrorProvider>
  );
}
