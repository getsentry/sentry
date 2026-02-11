import {useEffect} from 'react';
import * as qs from 'query-string';

import NotFound from 'sentry/components/errors/notFound';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {DATE_TIME_KEYS, URL_PARAM} from 'sentry/components/pageFilters/constants';
import PageFiltersContainer from 'sentry/components/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
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
  const {viewId} = useParams<{orgId?: string; viewId?: string}>();
  const onIssuesFeed = !viewId;

  return (
    <PageFiltersContainer
      skipLoadLastUsed={!onIssuesFeed}
      disablePersistence={!onIssuesFeed}
      skipInitializeUrlParams={!onIssuesFeed}
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

  return (
    <SentryDocumentTitle title={title} orgSlug={organization.slug}>
      <IssueViewWrapper>{children}</IssueViewWrapper>
    </SentryDocumentTitle>
  );
}

export default IssueListContainer;
