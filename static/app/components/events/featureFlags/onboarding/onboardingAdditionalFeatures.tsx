import {Fragment} from 'react';

import {Link} from 'sentry/components/core/link';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

export default function OnboardingAdditionalFeatures({
  organization,
}: {
  organization: Organization;
}) {
  return (
    <Fragment>
      <h3 style={{marginTop: '40px'}}>{t('Additional Features')}</h3>
      {tct(
        '[link:Change Tracking]: Configure Sentry to listen for additions, removals, and modifications to your feature flags.',
        {
          link: (
            <Link to={`/settings/${organization.slug}/feature-flags/change-tracking/`} />
          ),
        }
      )}
    </Fragment>
  );
}
