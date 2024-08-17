import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import useOrganization from 'sentry/utils/useOrganization';

export const TRACE_EXPLORER_DOCS_URL = 'https://docs.sentry.io/product/explore/traces/';

interface Props {
  children: React.ReactNode;
}

export default function TracesPage({children}: Props) {
  const organization = useOrganization();

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
