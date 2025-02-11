import Feature from 'sentry/components/acl/feature';
import {useRedirectNavV2Routes} from 'sentry/components/nav/useRedirectNavV2Routes';
import {NoAccess} from 'sentry/components/noAccess';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import Redirect from 'sentry/components/redirect';
import useOrganization from 'sentry/utils/useOrganization';

export const TRACE_EXPLORER_DOCS_URL = 'https://docs.sentry.io/product/explore/traces/';

interface Props {
  children: React.ReactNode;
}

export default function TracesPage({children}: Props) {
  const organization = useOrganization();

  const redirectPath = useRedirectNavV2Routes({
    oldPathPrefix: '/traces/',
    newPathPrefix: '/explore/traces/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return (
    <Feature
      features={['performance-trace-explorer']}
      organization={organization}
      renderDisabled={NoAccess}
    >
      <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
    </Feature>
  );
}
