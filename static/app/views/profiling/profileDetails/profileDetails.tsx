import {Fragment, useEffect} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {useCurrentProjectFromRouteParam} from 'sentry/utils/profiling/hooks/useCurrentProjectFromRouteParam';
import useOrganization from 'sentry/utils/useOrganization';

import {ProfileDetailsTable} from './components/profileDetailsTable';

function ProfileDetails() {
  const organization = useOrganization();
  const currentProject = useCurrentProjectFromRouteParam();
  useEffect(() => {
    trackAdvancedAnalyticsEvent('profiling_views.profile_summary', {
      organization,
      project_platform: currentProject?.platform,
    });
    // ignore  currentProject so we don't block the analytics event
    // or fire more than once unnecessarily
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
