import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import HookOrDefault from 'sentry/components/hookOrDefault';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import type {SimilarItem} from 'sentry/stores/groupingStore';
import GroupingStore from 'sentry/stores/groupingStore';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {useDetailedProject} from 'sentry/utils/useDetailedProject';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import usePrevious from 'sentry/utils/usePrevious';

import List from './list';

type Props = {
  project: Project;
};

type ItemState = {
  filtered: SimilarItem[];
  pageLinks: string | null;
  similar: SimilarItem[];
};

const DataConsentBanner = HookOrDefault({
  hookName: 'component:data-consent-banner',
  defaultComponent: null,
});
function SimilarStackTrace({project}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const params = useParams<{groupId: string; orgId: string}>();

  const [items, setItems] = useState<ItemState>({
    similar: [],
    filtered: [],
    pageLinks: null,
  });
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');

  const navigate = useNavigate();
  const prevLocationSearch = usePrevious(location.search);
  const hasSimilarityFeature = project.features.includes('similarity-view');
  const {data: projectData, isPending} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });
  // similarity-embeddings feature is only available on project details
  const hasSimilarityEmbeddingsFeature =
    projectData?.features.includes('similarity-embeddings') ||
    location.query.similarityEmbeddings === '1';
  // Use reranking by default (assuming the `seer.similarity.similar_issues.use_reranking`
  // backend option is using its default value of `True`). This is just so we can turn it off
  // on demand to see if/how that changes the results.
  const useReranking = String(location.query.useReranking !== '0');

  const fetchData = useCallback(() => {
    if (isPending) {
      return;
    }
    setStatus('loading');

    const reqs: Parameters<typeof GroupingStore.onFetch>[0] = [];

    if (hasSimilarityEmbeddingsFeature) {
      reqs.push({
        endpoint: `/organizations/${organization.slug}/issues/${params.groupId}/similar-issues-embeddings/?${qs.stringify(
          {
            k: 10,
            threshold: 0.01,
            useReranking,
          }
        )}`,
        dataKey: 'similar',
      });
    } else if (hasSimilarityFeature) {
      reqs.push({
        endpoint: `/organizations/${organization.slug}/issues/${params.groupId}/similar/?${qs.stringify(
          {
            ...location.query,
            limit: 50,
          }
        )}`,
        dataKey: 'similar',
      });
    }

    GroupingStore.onFetch(reqs);
  }, [
    location.query,
    params.groupId,
    organization.slug,
    hasSimilarityFeature,
    hasSimilarityEmbeddingsFeature,
    useReranking,
    isPending,
  ]);

  const onGroupingChange = useCallback(
    ({
      mergedParent,
      similarItems: updatedSimilarItems,
      filteredSimilarItems: updatedFilteredSimilarItems,
      similarLinks: updatedSimilarLinks,
      loading,
      error,
    }: any) => {
      if (updatedSimilarItems) {
        setItems({
          similar: updatedSimilarItems,
          filtered: updatedFilteredSimilarItems,
          pageLinks: updatedSimilarLinks,
        });
        setStatus(error ? 'error' : loading ? 'loading' : 'ready');
        return;
      }

      if (mergedParent && mergedParent !== params.groupId) {
        // Merge success, since we can't specify target, we need to redirect to new parent
        navigate(`/organizations/${organization.slug}/issues/${mergedParent}/similar/`);
      }
    },
    [navigate, params.groupId, organization.slug]
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
      query: location.query.query as string,
      projectId: firstIssue!.issue.project.slug,
    });
  }, [params, location.query, items]);

  const hasSimilarItems =
    (hasSimilarityFeature || hasSimilarityEmbeddingsFeature) &&
    (items.similar.length > 0 || items.filtered.length > 0);

  return (
    <Fragment>
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
      {status === 'ready' && !hasSimilarItems && !hasSimilarityEmbeddingsFeature && (
        <Panel>
          <EmptyStateWarning>
            <Title>{t("There don't seem to be any similar issues.")}</Title>
          </EmptyStateWarning>
        </Panel>
      )}
      {status === 'ready' && !hasSimilarItems && hasSimilarityEmbeddingsFeature && (
        <Panel>
          <EmptyStateWarning>
            <p>
              {t(
                "There don't seem to be any similar issues. This can occur when the issue has no stacktrace or in-app frames."
              )}
            </p>
          </EmptyStateWarning>
        </Panel>
      )}
      {status === 'ready' && hasSimilarItems && !hasSimilarityEmbeddingsFeature && (
        <List
          items={items.similar}
          filteredItems={items.filtered}
          onMerge={handleMerge}
          orgId={organization.slug}
          project={project}
          groupId={params.groupId}
          pageLinks={items.pageLinks}
          location={location}
          hasSimilarityEmbeddingsFeature={hasSimilarityEmbeddingsFeature}
        />
      )}
      {status === 'ready' && hasSimilarItems && hasSimilarityEmbeddingsFeature && (
        <List
          items={items.similar.concat(items.filtered)}
          filteredItems={[]}
          onMerge={handleMerge}
          orgId={organization.slug}
          project={project}
          groupId={params.groupId}
          pageLinks={items.pageLinks}
          location={location}
          hasSimilarityEmbeddingsFeature={hasSimilarityEmbeddingsFeature}
        />
      )}
      <DataConsentBanner source="grouping" />
    </Fragment>
  );
}

export default SimilarStackTrace;

const Title = styled('h4')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(0.75)};
`;

const HeaderWrapper = styled('div')`
  margin-bottom: ${space(2)};

  small {
    color: ${p => p.theme.subText};
  }
`;
