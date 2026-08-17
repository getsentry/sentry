import {SentryDateTimeProvider} from './datetime';
import {SentryLinkBehaviorProvider} from './link';
import {SentryTrackingProvider} from './tracking';

export function ScrapsProviders({children}: {children: React.ReactNode}) {
  return (
    <SentryDateTimeProvider>
      <SentryTrackingProvider>
        <SentryLinkBehaviorProvider>{children}</SentryLinkBehaviorProvider>
      </SentryTrackingProvider>
    </SentryDateTimeProvider>
  );
}
