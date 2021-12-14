import Button from 'sentry/components/button';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
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
  organization: Organization;
  buttonText: string;
  /**
   * Which project we should link to in the sandbox
   */
  projectSlug?: 'react' | 'python' | 'ios' | 'android' | 'react-native';
  /**
   * Matching on the error type or title
   */
  errorType?: string;

  buttonProps?: Partial<React.ComponentProps<typeof Button>>;
};

// Renders a form that will kick off the sandbox around children
// which should include be a button. If the sandbox is hidden,
// don't render the children
function DemoSandboxButton({
  scenario,
  projectSlug,
  organization,
  buttonText,
  errorType,
  buttonProps,
}: Props) {
  const handleOnClick = () =>
    trackAdvancedAnalyticsEvent('growth.clicked_enter_sandbox', {scenario, organization});

  const url = new URL('https://try.sentry-demo.com/demo/start/');

  if (scenario) url.searchParams.append('scenario', scenario);

  if (projectSlug) url.searchParams.append('projectSlug', projectSlug);

  if (errorType) url.searchParams.append('errorType', errorType);

  // always skip adding email when coming from in-product
  url.searchParams.append('skipEmail', '1');
  url.searchParams.append('saasOrgSlug', organization.slug);
  return (
    <Button external href={url.toString()} onClick={handleOnClick} {...buttonProps}>
      {buttonText}
    </Button>
  );
}

export default withOrganization(DemoSandboxButton);
