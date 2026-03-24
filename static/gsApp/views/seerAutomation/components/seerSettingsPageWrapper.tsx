import {Fragment, useEffect} from 'react';

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

  useEffect(() => {
    // If the org is not on the seat-based seer plan, then they should be redirected to the trial page
    if (
      showNewSeer(organization) &&
      !organization.features.includes('seat-based-seer-enabled')
    ) {
      navigate(normalizeUrl(`/settings/${organization.slug}/seer/trial/`));
      return;
    }
  }, [navigate, organization.features, organization.slug, organization]);

  const hasSeatBasedSeer = organization.features.includes('seat-based-seer-enabled');
  const hasLegacySeer = organization.features.includes('seer-added');
  const hasCodeReviewBeta = organization.features.includes('code-review-beta');

  if (hasSeatBasedSeer || hasLegacySeer || hasCodeReviewBeta) {
    return <Fragment>{children}</Fragment>;
  }

  return <NoAccess />;
}
