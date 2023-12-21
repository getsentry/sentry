import {useCallback, useEffect, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import * as qs from 'query-string';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
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

function SimilarStackTrace({params, location, project}: Props) {
  const {orgId, groupId} = params;

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
      reqs.push({
        endpoint: `/organizations/${orgId}/issues/${groupId}/similar/?${qs.stringify({
          ...location.query,
          limit: 50,
        })}`,
        dataKey: 'similar',
      });
    }

    GroupingStore.onFetch(reqs);
  }, [location.query, groupId, orgId, hasSimilarityFeature]);

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

  const hasSimilarItems =
    hasSimilarityFeature && (items.similar.length > 0 || items.filtered.length > 0);

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <HeaderWrapper>
          <Title>{t('Issues with a similar stack trace')}</Title>
          <small>
            {t(
              'This is an experimental feature. Data may not be immediately available while we process merges.'
            )}
          </small>
        </HeaderWrapper>
        {status === 'loading' && <LoadingIndicator />}
        {status === 'error' && (
          <LoadingError
            message={t('Unable to load similar issues, please try again later')}
            onRetry={fetchData}
          />
        )}
        {status === 'ready' && !hasSimilarItems && (
          <Panel>
            <EmptyStateWarning>
              <p>{t("There don't seem to be any similar issues.")}</p>
            </EmptyStateWarning>
          </Panel>
        )}
        {status === 'ready' && hasSimilarItems && (
          <List
            items={items.similar}
            filteredItems={items.filtered}
            onMerge={handleMerge}
            orgId={orgId}
            project={project}
            groupId={groupId}
            pageLinks={items.pageLinks}
          />
        )}
      </Layout.Main>
    </Layout.Body>
  );
}

export default SimilarStackTrace;

const Title = styled('h4')`
  margin-bottom: ${space(0.75)};
`;

const HeaderWrapper = styled('div')`
  margin-bottom: ${space(2)};

  small {
    color: ${p => p.theme.subText};
  }
`;
