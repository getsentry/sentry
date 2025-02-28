import type {ButtonProps} from 'sentry/components/button';
import {LinkButton} from 'sentry/components/button';
import type {Organization} from 'sentry/types/organization';
import type {SandboxData} from 'sentry/types/sandbox';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

type DemoSandboxButtonProps = ButtonProps & {
  /**
   * The deep link scenario
   */
  scenario:
    | 'performance'
    | 'releases'
    | 'alerts'
    | 'discover'
    | 'dashboards'
    | 'projects'
    | 'oneDiscoverQuery'
    | 'oneIssue'
    | 'oneBreadcrumb'
    | 'oneStackTrace'
    | 'oneTransaction'
    | 'oneWebVitals'
    | 'oneTransactionSummary'
    | 'oneRelease';
  clientData?: SandboxData;
  /**
   * Matching on the error type or title
   */
  errorType?: string;

  /**
   * Which project we should link to in the sandbox
   */
  projectSlug?: 'react' | 'python' | 'ios' | 'android' | 'react-native';

  /**
   * Where is the component being used
   */
  source?: string;
};

/**
 * Renders a button that will kick off the sandbox around children
 * which should include be a button. If the sandbox is hidden,
 * don't render the children
 */
function DemoSandboxButton({
  scenario,
  projectSlug,
  errorType,
  clientData,
  source,
  ...buttonProps
}: DemoSandboxButtonProps): React.ReactElement {
  const organization: Organization = useOrganization();
  const url = new URL('https://try.sentry-demo.com/demo/start/');

  if (scenario) {
    url.searchParams.append('scenario', scenario);
  }

  if (projectSlug) {
    url.searchParams.append('projectSlug', projectSlug);
  }

  if (errorType) {
    url.searchParams.append('errorType', errorType);
  }
  // always skip adding email when coming from in-product
  const clientOptions: SandboxData = {
    skipEmail: true,
    acceptedTracking: true,
    ...clientData,
  };
  url.searchParams.append('client', JSON.stringify(clientOptions));
  return (
    <LinkButton
      external
      href={url.toString()}
      onClick={() =>
        trackAnalytics('growth.clicked_enter_sandbox', {
          scenario,
          organization,
          source,
        })
      }
      {...buttonProps}
    />
  );
}

export default DemoSandboxButton;
