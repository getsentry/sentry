import {SentryLinkBehaviorProvider} from './link';
import {SentryTrackingProvider} from './tracking';

export function ScrapsProviders({children}: {children: React.ReactNode}) {
  return (
    <SentryTrackingProvider>
      <SentryLinkBehaviorProvider>{children}</SentryLinkBehaviorProvider>
    </SentryTrackingProvider>
  );
}
