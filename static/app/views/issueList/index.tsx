import {useEffect} from 'react';
import * as qs from 'query-string';

import NotFound from 'sentry/components/errors/notFound';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {DATE_TIME_KEYS, URL_PARAM} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import useRouteAnalyticsHookSetup from 'sentry/utils/routeAnalytics/useRouteAnalyticsHookSetup';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import usePrevious from 'sentry/utils/usePrevious';
import {getIssueViewQueryParams} from 'sentry/views/issueList/issueViews/getIssueViewQueryParams';
import {useSelectedGroupSearchView} from 'sentry/views/issueList/issueViews/useSelectedGroupSeachView';
import type {GroupSearchView} from 'sentry/views/issueList/types';
import {useUpdateGroupSearchViewLastVisited} from 'sentry/views/nav/secondary/sections/issues/issueViews/useUpdateGroupSearchViewLastVisited';
import {usePrefersStackedNav} from 'sentry/views/nav/usePrefersStackedNav';

type Props = {
  children: React.ReactNode;
  title?: string;
};

function useUpdateViewLastVisited({view}: {view: GroupSearchView | undefined}) {
  const {mutate: updateViewLastVisited} = useUpdateGroupSearchViewLastVisited();

  useEffect(() => {
    if (view?.id) {
      updateViewLastVisited({viewId: view.id});
    }
  }, [view?.id, updateViewLastVisited]);
}

// If loading `/issues/views/:viewId/` without any query params, append the
// ones from the view to the URL. It's important that we only do this when
// necessary because the URL params are used to override the view data.
function useHydrateIssueViewQueryParams({view}: {view: GroupSearchView | undefined}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const previousViewData = usePrevious(view);

  useEffect(() => {
    const query = qs.parse(window.location.search);

    if (
      view &&
      !query[URL_PARAM.PROJECT] &&
      !query[URL_PARAM.ENVIRONMENT] &&
      !DATE_TIME_KEYS.some(key => query[key]) &&
      !query.sort
    ) {
      navigate(
        normalizeUrl({
          pathname: `/organizations/${organization.slug}/issues/views/${view.id}/`,
          query: {
            ...getIssueViewQueryParams({view}),
            ...query,
          },
        }),
        {replace: true}
      );
    }
  }, [view, previousViewData, navigate, organization.slug]);
}

function StreamWrapper({children}: Props) {
  const organization = useOrganization();
  useRouteAnalyticsHookSetup();
  const prefersStackedNav = usePrefersStackedNav();
  const {viewId} = useParams<{orgId?: string; viewId?: string}>();

  const onNewIssuesFeed = prefersStackedNav && !viewId;
  const useGlobalPageFilters = !prefersStackedNav || onNewIssuesFeed;

  return (
    <PageFiltersContainer
      skipLoadLastUsed={!useGlobalPageFilters}
      disablePersistence={!useGlobalPageFilters}
      skipInitializeUrlParams={!onNewIssuesFeed && prefersStackedNav}
    >
      <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
    </PageFiltersContainer>
  );
}

function IssueViewWrapper({children}: Props) {
  const organization = useOrganization();
  const {data: groupSearchView, isLoading, isError} = useSelectedGroupSearchView();
  useUpdateViewLastVisited({view: groupSearchView});
  useHydrateIssueViewQueryParams({view: groupSearchView});

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <NotFound />;
  }

  if (groupSearchView) {
    return (
      <SentryDocumentTitle title={groupSearchView.name} orgSlug={organization.slug}>
        <StreamWrapper>{children}</StreamWrapper>
      </SentryDocumentTitle>
    );
  }

  return <StreamWrapper>{children}</StreamWrapper>;
}

function IssueListContainer({children, title = t('Issues')}: Props) {
  const organization = useOrganization();
  const prefersStackedNav = usePrefersStackedNav();

  return (
    <SentryDocumentTitle title={title} orgSlug={organization.slug}>
      {prefersStackedNav ? (
        <IssueViewWrapper>{children}</IssueViewWrapper>
      ) : (
        <StreamWrapper>{children}</StreamWrapper>
      )}
    </SentryDocumentTitle>
  );
}

export default IssueListContainer;
