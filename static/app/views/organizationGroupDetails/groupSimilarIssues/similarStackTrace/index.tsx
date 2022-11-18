import {useCallback, useEffect, useState} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import * as qs from 'query-string';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import GroupingStore, {SimilarItem} from 'sentry/stores/groupingStore';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import usePrevious from 'sentry/utils/usePrevious';

import List from './list';

type RouteParams = {
  groupId: string;
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  location: Location;
  project: Project;
};

type State = {
  error: boolean;
  filteredSimilarItems: SimilarItem[];
  loading: boolean;
  similarItems: SimilarItem[];
  similarLinks: string | null;
  v2: boolean;
};

function SimilarStackTrace({params, location, project}: Props) {
  const {orgId, groupId} = params;

  const [state, setState] = useState<State>({
    similarItems: [],
    filteredSimilarItems: [],
    similarLinks: null,
    loading: true,
    error: false,
    v2: false,
  });

  const prevLocationSearch = usePrevious(location.search);
  const hasSimilarityFeature = project.features.includes('similarity-view');

  const fetchData = useCallback(() => {
    setState(prevState => ({...prevState, loading: true, error: false}));

    const reqs: Parameters<typeof GroupingStore.onFetch>[0] = [];

    if (hasSimilarityFeature) {
      const version = state.v2 ? '2' : '1';

      reqs.push({
        endpoint: `/issues/${groupId}/similar/?${qs.stringify({
          ...location.query,
          limit: 50,
          version,
        })}`,
        dataKey: 'similar',
      });
    }

    GroupingStore.onFetch(reqs);
  }, [location.query, groupId, state.v2, hasSimilarityFeature]);

  const onGroupingChange = useCallback(
    ({
      mergedParent,
      similarItems,
      similarLinks,
      filteredSimilarItems,
      loading,
      error,
    }) => {
      if (similarItems) {
        setState(prevState => ({
          ...prevState,
          similarItems,
          similarLinks,
          filteredSimilarItems,
          loading: loading ?? false,
          error: error ?? false,
        }));
        return;
      }

      if (mergedParent && mergedParent !== groupId) {
        // Merge success, since we can't specify target, we need to redirect to new parent
        browserHistory.push(`/organizations/${orgId}/issues/${mergedParent}/similar/`);
      }
    },
    [groupId, orgId]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (prevLocationSearch !== location.search) {
      fetchData();
    }
  }, [fetchData, prevLocationSearch, location.search]);

  useEffect(() => {
    const unsubscribe = GroupingStore.listen(onGroupingChange, undefined);
    return () => {
      unsubscribe();
    };
  }, [onGroupingChange]);

  const toggleSimilarityVersion = useCallback(() => {
    setState(prevState => ({...prevState, v2: !prevState.v2}));
  }, []);

  const handleMerge = useCallback(() => {
    if (!params) {
      return;
    }

    // You need at least 1 similarItem OR filteredSimilarItems to be able to merge,
    // so `firstIssue` should always exist from one of those lists.
    //
    // Similar issues API currently does not return issues across projects,
    // so we can assume that the first issues project slug is the project in
    // scope
    const [firstIssue] = state.similarItems.length
      ? state.similarItems
      : state.filteredSimilarItems;

    GroupingStore.onMerge({
      params,
      query: location.query,
      projectId: firstIssue.issue.project.slug,
    });
  }, [params, location.query, state.similarItems, state.filteredSimilarItems]);

  const {similarItems, filteredSimilarItems, loading, error, v2, similarLinks} = state;

  const hasV2 = project.features.includes('similarity-view-v2');
  const isLoading = loading;
  const isError = error && !isLoading;
  const isLoadedSuccessfully = !isError && !isLoading;
  const hasSimilarItems =
    hasSimilarityFeature &&
    (similarItems.length > 0 || filteredSimilarItems.length > 0) &&
    isLoadedSuccessfully;

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <Alert type="warning">
          {t(
            'This is an experimental feature. Data may not be immediately available while we process merges.'
          )}
        </Alert>
        <HeaderWrapper>
          <Title>{t('Issues with a similar stack trace')}</Title>
          {hasV2 && (
            <ButtonBar merged active={v2 ? 'new' : 'old'}>
              <Button barId="old" size="sm" onClick={toggleSimilarityVersion}>
                {t('Old Algorithm')}
              </Button>
              <Button barId="new" size="sm" onClick={toggleSimilarityVersion}>
                {t('New Algorithm')}
              </Button>
            </ButtonBar>
          )}
        </HeaderWrapper>
        {isLoading && <LoadingIndicator />}
        {isError && (
          <LoadingError
            message={t('Unable to load similar issues, please try again later')}
            onRetry={fetchData}
          />
        )}
        {hasSimilarItems && (
          <List
            items={similarItems}
            filteredItems={filteredSimilarItems}
            onMerge={handleMerge}
            orgId={orgId}
            project={project}
            groupId={groupId}
            pageLinks={similarLinks}
            v2={v2}
          />
        )}
      </Layout.Main>
    </Layout.Body>
  );
}

export default SimilarStackTrace;

const Title = styled('h4')`
  margin-bottom: 0;
`;

const HeaderWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(2)};
`;
