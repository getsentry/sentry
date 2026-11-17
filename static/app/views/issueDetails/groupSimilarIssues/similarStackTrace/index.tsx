import {useCallback, useState} from 'react';
import {skipToken, useMutation, useQuery} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {mergeGroups} from 'sentry/actionCreators/group';
import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useGroupId} from 'sentry/views/issueDetails/groupIdContext';
import {relatedIssuesApiOptions} from 'sentry/views/issueDetails/groupRelatedIssues/relatedIssuesApiOptions';

import {List} from './list';
import {processSimilarItem, toSimilarTuple} from './types';
import type {SimilarApiResponse, SimilarItem} from './types';

type Props = {
  project: Project;
};

const DataConsentBanner = OverrideOrDefault({
  overrideName: 'component:data-consent-banner',
  defaultComponent: null,
});

const EMPTY_SET: ReadonlySet<string> = new Set();

function splitByThreshold(items: SimilarItem[]) {
  return {
    similar: items.filter(item => !item.isBelowThreshold),
    filtered: items.filter(item => item.isBelowThreshold),
  };
}

export function SimilarStackTrace({project}: Props) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const groupId = useGroupId();
  const navigate = useNavigate();

  const [checkedIds, setCheckedIds] = useState(new Set<string>());

  const hasSimilarityFeature = project.features.includes('similarity-view');
  const {data: projectData, isPending: isProjectPending} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });
  // similarity-embeddings feature is only available on project details
  const hasEmbeddings = projectData?.features.includes('similarity-embeddings') ?? false;

  const canFetch = !isProjectPending && (hasSimilarityFeature || hasEmbeddings);

  // Projects that use Seer similarity read the related issues endpoint. The rest read the
  // legacy similarity index.
  const embeddingsQuery = useQuery({
    ...relatedIssuesApiOptions({
      organization,
      groupId,
      types: ['similar_stacktrace'],
      enabled: canFetch && hasEmbeddings,
    }),
    select: response =>
      splitByThreshold(
        response.json.data.map(item => processSimilarItem(toSimilarTuple(item), true))
      ),
  });
  const legacyQuery = useQuery({
    ...apiOptions.as<SimilarApiResponse>()(
      '/organizations/$organizationIdOrSlug/issues/$issueId/similar/',
      {
        path:
          canFetch && !hasEmbeddings
            ? {organizationIdOrSlug: organization.slug, issueId: groupId}
            : skipToken,
        query: {limit: 50},
        staleTime: 0,
      }
    ),
    select: response =>
      splitByThreshold(response.json.map(tuple => processSimilarItem(tuple, false))),
  });
  const {
    data: result,
    isPending,
    isError,
    refetch,
  } = hasEmbeddings ? embeddingsQuery : legacyQuery;

  // During an in-flight merge, the ids being merged are frozen on the mutation's
  // `variables`; we derive the "busy" set from that instead of a second useState.
  const {
    mutate: mergeMutate,
    isPending: isMerging,
    variables,
  } = useMutation<
    {merge?: {parent?: string}} | undefined,
    Error,
    {ids: string[]; projectSlug: string}
  >({
    mutationFn: ({ids, projectSlug}) =>
      mergeGroups(api, {
        orgId: organization.slug,
        projectId: projectSlug,
        itemIds: [...ids, groupId],
      }),
    onSuccess: data => {
      if (data?.merge?.parent && data.merge.parent !== groupId) {
        navigate(
          `/organizations/${organization.slug}/issues/${data.merge.parent}/similar/`
        );
      }
      setCheckedIds(new Set());
    },
  });

  const busyIds = isMerging && variables ? new Set(variables.ids) : EMPTY_SET;
  const {similar = [], filtered = []} = result ?? {};

  const handleToggle = useCallback(
    (id: string) => {
      if (isMerging) {
        return;
      }
      setCheckedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [isMerging]
  );

  const handleMerge = useCallback(() => {
    if (checkedIds.size === 0) {
      return;
    }
    // Similar issues API does not return issues across projects, so the first
    // item's project slug is the project in scope.
    const [firstIssue] = similar.length ? similar : filtered;
    if (!firstIssue) {
      return;
    }
    mergeMutate({
      ids: Array.from(checkedIds),
      projectSlug: firstIssue.issue.project.slug,
    });
  }, [checkedIds, similar, filtered, mergeMutate]);

  const loading = isPending || isProjectPending || !canFetch;

  return (
    <Stack gap="xl" align="stretch">
      <Stack gap="xs" align="stretch">
        <Heading as="h4" size="lg">
          {t('Issues with a similar stack trace')}
        </Heading>
        <Text as="p" variant="muted" size="sm">
          {t(
            'This is an experimental feature. Data may not be immediately available while we process merges.'
          )}
        </Text>
      </Stack>
      <List
        loading={loading}
        isError={isError}
        onRetry={() => refetch()}
        emptyMessage={getEmptyMessage(hasEmbeddings)}
        items={similar}
        filteredItems={filtered}
        onMerge={handleMerge}
        onToggle={handleToggle}
        checkedIds={checkedIds}
        busyIds={busyIds}
        project={project}
        groupId={groupId}
        hasSimilarityEmbeddingsFeature={hasEmbeddings}
      />
      <DataConsentBanner source="grouping" />
    </Stack>
  );
}

function getEmptyMessage(hasEmbeddings: boolean) {
  if (hasEmbeddings) {
    return t(
      'No similar issues found. This can happen when the issue has no stacktrace or in-app frames.'
    );
  }
  return t('No similar issues found.');
}
