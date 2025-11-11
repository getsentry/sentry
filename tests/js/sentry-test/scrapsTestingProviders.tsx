import {SentryLinkBehaviorProvider} from 'sentry/scrapsProviders/link';

export function ScrapsTestingProviders({children}: {children: React.ReactNode}) {
  return <SentryLinkBehaviorProvider>{children}</SentryLinkBehaviorProvider>;
}
