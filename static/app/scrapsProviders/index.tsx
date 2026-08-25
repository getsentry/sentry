import {TranslationContextProvider} from '@sentry/scraps/translationContext';

import {t, tct} from 'sentry/locale';

import {SentryLinkBehaviorProvider} from './link';
import {SentryTrackingProvider} from './tracking';

const sentryTranslation = {t, tct};

export function ScrapsProviders({children}: {children: React.ReactNode}) {
  return (
    <TranslationContextProvider value={sentryTranslation}>
      <SentryTrackingProvider>
        <SentryLinkBehaviorProvider>{children}</SentryLinkBehaviorProvider>
      </SentryTrackingProvider>
    </TranslationContextProvider>
  );
}
