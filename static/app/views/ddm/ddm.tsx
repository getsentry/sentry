import {useEffect} from 'react';

import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {DDMContextProvider} from 'sentry/views/ddm/context';
import {DDMLayout} from 'sentry/views/ddm/layout';
import {useScratchpads} from 'sentry/views/ddm/scratchpadSelector';

function DDM() {
  const organization = useOrganization();

  const {selected, isLoading} = useScratchpads();

  useEffect(() => {
    trackAnalytics('ddm.page-view', {
      organization,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SentryDocumentTitle title={t('Metrics')} orgSlug={organization.slug}>
      <PageFiltersContainer disablePersistence={!!selected}>
        {!isLoading && (
          <DDMContextProvider>
            <DDMLayout />
          </DDMContextProvider>
        )}
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

export default DDM;
