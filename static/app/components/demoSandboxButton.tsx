import Button, {ButtonPropsWithoutAriaLabel} from 'sentry/components/button';
import {Organization, SandboxData} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';

interface DemoSandboxButtonProps extends ButtonPropsWithoutAriaLabel {
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
}

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
    <Button
      external
      href={url.toString()}
      onClick={() =>
        trackAdvancedAnalyticsEvent('growth.clicked_enter_sandbox', {
          scenario,
          organization,
        })
      }
      {...buttonProps}
    />
  );
}

export default DemoSandboxButton;
