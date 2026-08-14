import {SentryLinkBehaviorProvider} from './link';
import {SentryTimeFormatProvider} from './timeFormat';
import {SentryTrackingProvider} from './tracking';

export function ScrapsProviders({children}: {children: React.ReactNode}) {
  return (
    <SentryTimeFormatProvider>
      <SentryTrackingProvider>
        <SentryLinkBehaviorProvider>{children}</SentryLinkBehaviorProvider>
      </SentryTrackingProvider>
    </SentryTimeFormatProvider>
  );
}
