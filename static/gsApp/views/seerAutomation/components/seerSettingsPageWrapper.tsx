import {useEffect} from 'react';

import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import showNewSeer from 'sentry/utils/seer/showNewSeer';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  children: React.ReactNode;
}

export default function SeerSettingsPageWrapper({children}: Props) {
  const navigate = useNavigate();
  const organization = useOrganization();

  useEffect(() => {
    // If the org is on the old-seer plan then they shouldn't be here on this new settings page
    // Or if we havn't launched the new seer yet.
    // Then they need to see old settings page, or get downgraded off old seer.
    if (!showNewSeer(organization)) {
      navigate(normalizeUrl(`/settings/${organization.slug}/seer/`));
      return;
    }

    // If the org is not on the seat-based seer plan, then they should be redirected to the trial page
    if (!organization.features.includes('seat-based-seer-enabled')) {
      navigate(normalizeUrl(`/settings/${organization.slug}/seer/trial/`));
      return;
    }

    // Else you do have the new seer plan, then stay here and edit some settings.
  }, [navigate, organization.features, organization.slug, organization]);

  return (
    <Feature
      features={['seat-based-seer-enabled']}
      organization={organization}
      renderDisabled={NoAccess}
    >
      <SentryDocumentTitle title={t('Seer')} orgSlug={organization.slug} />

      {children}
    </Feature>
  );
}
