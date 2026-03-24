import {Outlet} from 'react-router-dom';

import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {useOrganization} from 'sentry/utils/useOrganization';

export default function PreprodContainer() {
  const organization = useOrganization();

  return (
    <NoProjectMessage organization={organization}>
      <Outlet />
    </NoProjectMessage>
  );
}
