import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useRouteAnalyticsHookSetup from 'sentry/utils/routeAnalytics/useRouteAnalyticsHookSetup';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {usePrefersStackedNav} from 'sentry/views/nav/prefersStackedNav';

type Props = {
  children: React.ReactNode;
};

function IssueListContainer({children}: Props) {
  const organization = useOrganization();
  useRouteAnalyticsHookSetup();
  const prefersStackedNav = usePrefersStackedNav();
  const {viewId} = useParams<{orgId?: string; viewId?: string}>();

  const onNewIssuesFeed = prefersStackedNav && !viewId;
  const useGlobalPageFilters =
    !organization.features.includes('issue-stream-custom-views') || onNewIssuesFeed;

  return (
    <SentryDocumentTitle title={t('Issues')} orgSlug={organization.slug}>
      <PageFiltersContainer
        skipLoadLastUsed={!useGlobalPageFilters}
        disablePersistence={!useGlobalPageFilters}
        skipInitializeUrlParams={
          !onNewIssuesFeed && organization.features.includes('issue-stream-custom-views')
        }
      >
        <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

export default IssueListContainer;
