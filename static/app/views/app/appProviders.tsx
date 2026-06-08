import {Fragment} from 'react';

import {UserTimezoneProvider} from 'sentry/components/timezoneProvider';
import {DemoToursProvider} from 'sentry/utils/demoMode/demoTours';
import {GlobalFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {AsyncSDKIntegrationContextProvider} from 'sentry/views/app/asyncSDKIntegrationProvider';
import {GlobalAlertProvider} from 'sentry/views/app/globalAlerts';
import {LastKnownRouteContextProvider} from 'sentry/views/lastKnownRouteContextProvider';
import {OrganizationContextProvider} from 'sentry/views/organizationContext';
import {RouteAnalyticsContextProvider} from 'sentry/views/routeAnalyticsContextProvider';
import {LLMContextProvider} from 'sentry/views/seerExplorer/contexts/llmContext';

interface AppProvidersProps {
  children: NonNullable<React.ReactNode>;
  /**
   * When false, the OrganizationContextProvider is skipped. This avoids
   * triggering 401 errors before the user is logged in.
   */
  preloadData: boolean;
}

/**
 * Wraps `children` in the stack of context providers required by the
 * authenticated app. Listed outermost-first; each entry is composed with its
 * predecessor so the tree mirrors the order of the array.
 */
export function AppProviders({preloadData, children}: AppProvidersProps) {
  const OrganizationProvider = preloadData ? OrganizationContextProvider : Fragment;

  const providers: Array<React.ComponentType<{children: NonNullable<React.ReactNode>}>> =
    [
      UserTimezoneProvider,
      LastKnownRouteContextProvider,
      RouteAnalyticsContextProvider,
      OrganizationProvider,
      AsyncSDKIntegrationContextProvider,
      GlobalFeedbackForm,
      DemoToursProvider,
      LLMContextProvider,
      GlobalAlertProvider,
    ];

  return providers.reduceRight((acc, Provider) => <Provider>{acc}</Provider>, children);
}
