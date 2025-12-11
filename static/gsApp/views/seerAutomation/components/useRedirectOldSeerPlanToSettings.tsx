import {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';

import useOrganization from 'sentry/utils/useOrganization';

export default function useRedirectOldSeerPlanToSettings() {
  const navigate = useNavigate();
  const organization = useOrganization();

  useEffect(() => {
    // If the org is on the old-seer plan then they shouldn't be here on this new settings page
    if (organization.features.includes('seer-added')) {
      // redirect to the root settins page
      navigate('/settings/seer');
    }
  }, [navigate, organization.features]);
}
