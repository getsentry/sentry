import {
  TranslationContextProvider,
  type TranslationContextValue,
} from '@sentry/scraps/translationContext';

import {SentryLinkBehaviorProvider} from 'sentry/scrapsProviders/link';

const testTranslation: TranslationContextValue = {
  t: (string, ...args) =>
    string.replace('%s', typeof args[0] === 'string' ? args[0] : ''),
  tct: template => template,
};

export function ScrapsTestingProviders({children}: {children: React.ReactNode}) {
  return (
    <TranslationContextProvider value={testTranslation}>
      <SentryLinkBehaviorProvider>{children}</SentryLinkBehaviorProvider>
    </TranslationContextProvider>
  );
}
