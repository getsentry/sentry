import {ToastProvider} from '@sentry/scraps/toast';
import {TranslationContextProvider} from '@sentry/scraps/translation';

import {t, tct} from 'sentry/locale';

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
          <SentryLinkBehaviorProvider>
            <SentryOverlayProvider>
              <ToastProvider>{children}</ToastProvider>
            </SentryOverlayProvider>
          </SentryLinkBehaviorProvider>
        </SentryDateTimeProvider>
      </TranslationContextProvider>
    </SentryFormErrorProvider>
  );
}
