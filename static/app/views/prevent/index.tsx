import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import Redirect from 'sentry/components/redirect';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {PREVENT_BASE_URL} from 'sentry/views/prevent/settings';

interface Props {
  children: React.ReactNode;
}

export default function PreventPage({children}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  // Redirect to coverage page if the user lands on the codecov page
  if (
    location.pathname === `/${PREVENT_BASE_URL}/` ||
    location.pathname === `/${PREVENT_BASE_URL}/coverage`
  ) {
    return <Redirect to={`/${PREVENT_BASE_URL}/coverage/commits/`} />;
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
