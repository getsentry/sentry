import {Fragment, useEffect} from 'react';

import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import {showNewSeer} from 'sentry/utils/seer/showNewSeer';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Props {
  children: React.ReactNode;
}

export function SeerSettingsPageWrapper({children}: Props) {
  const navigate = useNavigate();
  const organization = useOrganization();
  const hasSeatBasedSeer = organization.features.includes('seat-based-seer-enabled');
  const isNewSeer = showNewSeer(organization);

  useEffect(() => {
    // Trial is only for new Seer launch cohorts that aren't seat-based yet.
    if (isNewSeer && !hasSeatBasedSeer) {
      navigate(normalizeUrl(`/settings/${organization.slug}/seer/trial/`));
      return;
    }
  }, [hasSeatBasedSeer, isNewSeer, navigate, organization.slug]);

  if (!isNewSeer) {
    return <Fragment>{children}</Fragment>;
  }

  return (
    <Feature
      features={['seat-based-seer-enabled']}
      organization={organization}
      renderDisabled={NoAccess}
    >
      {children}
    </Feature>
  );
}
