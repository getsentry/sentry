import {usePrefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useRouteAnalyticsHookSetup from 'sentry/utils/routeAnalytics/useRouteAnalyticsHookSetup';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

type Props = {
  children: React.ReactNode;
};

function IssueListContainer({children}: Props) {
  const organization = useOrganization();
  useRouteAnalyticsHookSetup();
  const prefersStackedNav = usePrefersStackedNav();
  const location = useLocation();
  const {viewId} = useParams<{orgId?: string; viewId?: string}>();

  const onAllIssues = location.pathname === '/issues/' && !viewId;

  const useGlobalPageFilters =
    !organization.features.includes('issue-stream-custom-views') ||
    (prefersStackedNav && onAllIssues);

  return (
    <SentryDocumentTitle title={t('Issues')} orgSlug={organization.slug}>
      <PageFiltersContainer
        skipLoadLastUsed={!useGlobalPageFilters}
        disablePersistence={!useGlobalPageFilters}
      >
        <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

export default IssueListContainer;
