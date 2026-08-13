import {SentryLinkBehaviorProvider} from './link';
import {SentryTimezoneProvider} from './timezone';
import {SentryTrackingProvider} from './tracking';

export function ScrapsProviders({children}: {children: React.ReactNode}) {
  return (
    <SentryTimezoneProvider>
      <SentryTrackingProvider>
        <SentryLinkBehaviorProvider>{children}</SentryLinkBehaviorProvider>
      </SentryTrackingProvider>
    </SentryTimezoneProvider>
  );
}
