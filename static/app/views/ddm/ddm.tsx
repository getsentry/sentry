import {useEffect} from 'react';

import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {DDMLayout} from 'sentry/views/ddm/layout';

function DDM() {
  const organization = useOrganization();

  useEffect(() => {
    trackAnalytics('ddm.page-view', {
      organization,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SentryDocumentTitle title={t('DDM')} orgSlug={organization.slug}>
      <PageFiltersContainer disablePersistence>
        <DDMLayout />
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

export default DDM;
