import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {AiHeader} from 'sentry/views/insights/pages/ai/aiPageHeader';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {getPerformanceLandingUrl} from 'sentry/views/performance/utils';

export function TrendsHeader() {
  const location = useLocation();
  const organization = useOrganization();
  const {view, isInDomainView} = useDomainViewFilters();

  const headerTitle = t('Trends');

  const getPerformanceLink = () => {
    const newQuery = {
      ...location.query,
    };
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);

    // This stops errors from occurring when navigating to other views since we are appending aggregates to the trends view
    conditions.removeFilter('tpm()');
    conditions.removeFilter('confidence()');
    conditions.removeFilter('transaction.duration');
    newQuery.query = conditions.formatString();
    return {
      pathname: getPerformanceLandingUrl(organization),
      query: newQuery,
    };
  };

  if (!isInDomainView) {
    return (
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              {
                label: t('Performance'),
                to: getPerformanceLink(),
              },
              {
                label: headerTitle,
              },
            ]}
          />
          <Layout.Title>{headerTitle}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
    );
  }

  const headerProps = {
    headerTitle,
    breadcrumbs: [{label: headerTitle, to: undefined}],
  };

  if (view === 'ai') {
    return <AiHeader {...headerProps} />;
  }

  if (view === 'frontend') {
    return <FrontendHeader {...headerProps} />;
  }

  if (view === 'mobile') {
    return <MobileHeader {...headerProps} />;
  }

  return <BackendHeader {...headerProps} />;
}
