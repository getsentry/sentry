import {useState} from 'react';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {t} from 'sentry/locale';
import {
  DEFAULT_QUERY_CLIENT_CONFIG,
  QueryClient,
  QueryClientProvider,
} from 'sentry/utils/queryClient';
import {useSetupWizardViewedAnalytics} from 'sentry/views/setupWizard/utils/setupWizardAnalytics';
import {useOrganizationsWithRegion} from 'sentry/views/setupWizard/utils/useOrganizationsWithRegion';
import {WaitingForWizardToConnect} from 'sentry/views/setupWizard/waitingForWizardToConnect';
import {WizardProjectSelection} from 'sentry/views/setupWizard/wizardProjectSelection';

const queryClient = new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG);

type Props = {
  hash: string;
  enableProjectSelection?: boolean;
};

function SetupWizard({hash, enableProjectSelection = false}: Props) {
  const [router] = useState(() =>
    createBrowserRouter([
      {
        path: '*',
        element: (
          <SetupWizardContent
            hash={hash}
            enableProjectSelection={enableProjectSelection}
          />
        ),
      },
    ])
  );

  return (
    <ThemeAndStyleProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeAndStyleProvider>
  );
}

function SetupWizardContent({hash, enableProjectSelection}: Props) {
  const {data: organizations, isError, isLoading} = useOrganizationsWithRegion();

  useSetupWizardViewedAnalytics(organizations);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError || !organizations) {
    return <LoadingError message={t('Failed to load organizations')} />;
  }

  return enableProjectSelection ? (
    <WizardProjectSelection hash={hash} organizations={organizations} />
  ) : (
    <WaitingForWizardToConnect hash={hash} organizations={organizations} />
  );
}

export default SetupWizard;
