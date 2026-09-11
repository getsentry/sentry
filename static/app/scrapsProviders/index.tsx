import {TranslationContextProvider} from '@sentry/scraps/translationContext';

import {t, tct} from 'sentry/locale';

import {SentryDateTimeProvider} from './datetime';
import {SentryFormErrorProvider} from './formError';
import {SentryLinkBehaviorProvider} from './link';

const sentryTranslation = {t, tct};

export function ScrapsProviders({children}: {children: React.ReactNode}) {
  return (
    <SentryFormErrorProvider>
      <TranslationContextProvider value={sentryTranslation}>
        <SentryDateTimeProvider>
          <SentryLinkBehaviorProvider>{children}</SentryLinkBehaviorProvider>
        </SentryDateTimeProvider>
      </TranslationContextProvider>
    </SentryFormErrorProvider>
  );
}
