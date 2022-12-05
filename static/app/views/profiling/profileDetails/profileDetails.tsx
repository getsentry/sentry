import {Fragment, useEffect} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';

import {ProfileDetailsTable} from './components/profileDetailsTable';

function ProfileDetails() {
  const organization = useOrganization();

  useEffect(() => {
    trackAdvancedAnalyticsEvent('profiling_views.profile_summary', {
      organization,
    });
  }, [organization]);

  return (
    <Fragment>
      <SentryDocumentTitle
        title={t('Profiling \u2014 Details')}
        orgSlug={organization.slug}
      >
        <Layout.Body>
          <Layout.Main fullWidth>
            <ProfileDetailsTable />
          </Layout.Main>
        </Layout.Body>
      </SentryDocumentTitle>
    </Fragment>
  );
}

export default ProfileDetails;
