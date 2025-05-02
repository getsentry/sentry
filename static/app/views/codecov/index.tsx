import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import Redirect from 'sentry/components/redirect';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {CODECOV_BASE_URL} from 'sentry/views/codecov/settings';

interface Props {
  children: React.ReactNode;
}

export default function CodecovPage({children}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  // Redirect to coverage page if the user lands on the codecov page
  if (
    location.pathname === `/${CODECOV_BASE_URL}/` ||
    location.pathname === `/${CODECOV_BASE_URL}/coverage`
  ) {
    return <Redirect to={`/${CODECOV_BASE_URL}/coverage/commits/`} />;
  }

  return (
    <Feature
      features={['codecov-ui']}
      organization={organization}
      renderDisabled={NoAccess}
    >
      <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
    </Feature>
  );
}
