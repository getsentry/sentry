import {useCallback, useEffect, useState} from 'react';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import {wrapCreateBrowserRouterV6} from '@sentry/react';

import {fetchOrganizations} from 'sentry/actionCreators/organizations';
import Indicators from 'sentry/components/indicators';
import {DocumentTitleManager} from 'sentry/components/sentryDocumentTitle/documentTitleManager';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {ScrapsProviders} from 'sentry/scrapsProviders';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Config} from 'sentry/types/system';
import {DANGEROUS_SET_REACT_ROUTER_6_HISTORY} from 'sentry/utils/browserHistory';
import {
  DEFAULT_QUERY_CLIENT_CONFIG,
  QueryClient,
  QueryClientProvider,
} from 'sentry/utils/queryClient';
import {shouldPreloadData} from 'sentry/utils/shouldPreloadData';
import useApi from 'sentry/utils/useApi';
import {GithubInstallationSelect} from 'sentry/views/integrationPipeline/githubInstallationSelect';
import {OrganizationContextProvider} from 'sentry/views/organizationContext';

import AwsLambdaCloudformation from './awsLambdaCloudformation';
import AwsLambdaFailureDetails from './awsLambdaFailureDetails';
import AwsLambdaFunctionSelect from './awsLambdaFunctionSelect';
import AwsLambdaProjectSelect from './awsLambdaProjectSelect';

const pipelineMapper: Record<string, [React.ComponentType<any>, string]> = {
  awsLambdaProjectSelect: [AwsLambdaProjectSelect, 'AWS Lambda Select Project'],
  awsLambdaFunctionSelect: [AwsLambdaFunctionSelect, 'AWS Lambda Select Lambdas'],
  awsLambdaCloudformation: [AwsLambdaCloudformation, 'AWS Lambda Create Cloudformation'],
  awsLambdaFailureDetails: [AwsLambdaFailureDetails, 'AWS Lambda View Failures'],
  githubInstallationSelect: [GithubInstallationSelect, 'GitHub Select Installation'],
};

type Props = {
  [key: string]: any;
  pipelineName: string;
};

function buildRouter(Component: React.ComponentType, props: any) {
  const sentryCreateBrowserRouter = wrapCreateBrowserRouterV6(createBrowserRouter);
  const router = sentryCreateBrowserRouter([
    {
      path: '*',
      element: (
        <ScrapsProviders>
          <Component {...props} props={props} />
        </ScrapsProviders>
      ),
    },
  ]);
  DANGEROUS_SET_REACT_ROUTER_6_HISTORY(router);
  return router;
}

const queryClient = new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG);

/**
 * This component is a wrapper for specific pipeline views for integrations
 */
function PipelineView({pipelineName, ...props}: Props) {
  const mapping = pipelineMapper[pipelineName];

  if (!mapping) {
    throw new Error(`Invalid pipeline name ${pipelineName}`);
  }

  const [Component, title] = mapping;
  const api = useApi();
  const config = useLegacyStore(ConfigStore);
  const preloadData = shouldPreloadData(config);

  /**
   * Loads the users organization list into the OrganizationsStore
   */
  const loadOrganizations = useCallback(async () => {
    try {
      const data = await fetchOrganizations(api, {member: '1'});
      OrganizationsStore.load(data);
    } catch {
      // TODO: do something?
    }
  }, [api]);

  /**
   * Bootstraps select parts of the app, taken from static/app/index.tsx
   * - Sets CSRF token for api requests
   * - Registers etsentry hooks
   */
  const bootstrapApp = useCallback(async () => {
    const BOOTSTRAP_URL = '/api/client-config/';
    const response = await fetch(BOOTSTRAP_URL);
    const data: Config = await response.json();

    window.csrfCookieName = data.csrfCookieName;
    window.superUserCookieName = data.superUserCookieName;
    window.superUserCookieDomain = data.superUserCookieDomain ?? undefined;

    // eslint-disable-next-line boundaries/element-types -- getsentry entrypoint
    const registerHooksImport = import('getsentry/registerHooks');
    const {default: registerHooks} = await registerHooksImport;
    registerHooks();
  }, []);

  // Set the page title
  useEffect(() => void (document.title = title), [title]);

  useEffect(() => {
    loadOrganizations();
    bootstrapApp();
  }, [loadOrganizations, bootstrapApp]);
  const [router] = useState(() => buildRouter(Component, props));

  const renderOrganizationContextProvider = useCallback(
    (content: React.ReactNode) => {
      // Skip loading organization-related data before the user is logged in,
      // because it triggers a 401 error in the UI.
      if (!preloadData) {
        return content;
      }
      return <OrganizationContextProvider>{content}</OrganizationContextProvider>;
    },
    [preloadData]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DocumentTitleManager>
        <ThemeAndStyleProvider>
          <Indicators className="indicators-container" />
          {renderOrganizationContextProvider(<RouterProvider router={router} />)}
        </ThemeAndStyleProvider>
      </DocumentTitleManager>
    </QueryClientProvider>
  );
}

export default PipelineView;
