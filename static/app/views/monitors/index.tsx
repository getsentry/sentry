import {useEffect} from 'react';

import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

function MonitorsContainer() {
  const organization = useOrganization();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(
      normalizeUrl(`/organizations/${organization.slug}/insights/backend/crons/`),
      {replace: true}
    );
  });

  return null;
}

export default MonitorsContainer;
