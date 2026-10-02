import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {Outlet} from 'sentry/router/reactRouter';
import {useOrganization} from 'sentry/utils/useOrganization';

export default function PreprodContainer() {
  const organization = useOrganization();

  return (
    <NoProjectMessage organization={organization}>
      <Outlet />
    </NoProjectMessage>
  );
}
