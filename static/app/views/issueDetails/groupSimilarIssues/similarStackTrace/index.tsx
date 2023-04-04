import {useCallback, useEffect, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import * as qs from 'query-string';

import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import IssuesReplayCountProvider from 'sentry/components/replays/issuesReplayCountProvider';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import GroupingStore, {SimilarItem} from 'sentry/stores/groupingStore';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {useNavigate} from 'sentry/utils/useNavigate';
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

type ItemState = {
  filtered: SimilarItem[];
  pageLinks: string | null;
  similar: SimilarItem[];
};

const SimilarStackTrace = ({params, location, project}: Props) => {
  const {orgId, groupId} = params;

  const [isUsingSimilarityViewV2, setIsUsingSimilarityViewV2] = useState<boolean>(false);
  const [items, setItems] = useState<ItemState>({
    similar: [],
    filtered: [],
    pageLinks: null,
  });
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');

  const navigate = useNavigate();
  const prevLocationSearch = usePrevious(location.search);
  const hasSimilarityFeature = project.features.includes('similarity-view');

  const fetchData = useCallback(() => {
    setStatus('loading');

    const reqs: Parameters<typeof GroupingStore.onFetch>[0] = [];

    if (hasSimilarityFeature) {
      const version = isUsingSimilarityViewV2 ? '2' : '1';

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
  }, [location.query, groupId, isUsingSimilarityViewV2, hasSimilarityFeature]);

  const onGroupingChange = useCallback(
    ({
      mergedParent,
      similarItems: updatedSimilarItems,
      filteredSimilarItems: updatedFilteredSimilarItems,
      similarLinks: updatedSimilarLinks,
      loading,
      error,
    }) => {
      if (updatedSimilarItems) {
        setItems({
          similar: updatedSimilarItems,
          filtered: updatedFilteredSimilarItems,
          pageLinks: updatedSimilarLinks,
        });
        setStatus(error ? 'error' : loading ? 'loading' : 'ready');
        return;
      }

      if (mergedParent && mergedParent !== groupId) {
        // Merge success, since we can't specify target, we need to redirect to new parent
        navigate(`/organizations/${orgId}/issues/${mergedParent}/similar/`);
      }
    },
    [navigate, groupId, orgId]
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
    const [firstIssue] = items.similar.length ? items.similar : items.filtered;

    GroupingStore.onMerge({
      params,
      query: location.query,
      projectId: firstIssue.issue.project.slug,
    });
  }, [params, location.query, items]);

  const hasSimilarityViewV2 = project.features.includes('similarity-view-v2');
  const hasSimilarItems =
    hasSimilarityFeature &&
    (items.similar.length > 0 || items.filtered.length > 0) &&
    status === 'ready';

  const groupsIds = items.similar.concat(items.filtered).map(({issue}) => issue.id);

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
          {hasSimilarityViewV2 && (
            <SegmentedControl
              aria-label={t('Algorithm')}
              size="sm"
              value={isUsingSimilarityViewV2 ? 'new' : 'old'}
              onChange={key => setIsUsingSimilarityViewV2(key === 'new')}
            >
              <SegmentedControl.Item key="old">
                {t('Old Algorithm')}
              </SegmentedControl.Item>
              <SegmentedControl.Item key="new">
                {t('New Algorithm')}
              </SegmentedControl.Item>
            </SegmentedControl>
          )}
        </HeaderWrapper>
        {status === 'loading' && <LoadingIndicator />}
        {status === 'error' && (
          <LoadingError
            message={t('Unable to load similar issues, please try again later')}
            onRetry={fetchData}
          />
        )}
        {hasSimilarItems && (
          <IssuesReplayCountProvider groupIds={groupsIds}>
            <List
              items={items.similar}
              filteredItems={items.filtered}
              onMerge={handleMerge}
              orgId={orgId}
              project={project}
              groupId={groupId}
              pageLinks={items.pageLinks}
              v2={isUsingSimilarityViewV2}
            />
          </IssuesReplayCountProvider>
        )}
      </Layout.Main>
    </Layout.Body>
  );
};

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
