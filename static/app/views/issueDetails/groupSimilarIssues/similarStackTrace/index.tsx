import {useCallback, useState} from 'react';
import {skipToken, useMutation, useQuery} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {mergeGroups} from 'sentry/actionCreators/group';
import {HookOrDefault} from 'sentry/components/hookOrDefault';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useGroupEvent} from 'sentry/views/issueDetails/useGroupEvent';

import {List} from './list';
import {processSimilarItem} from './types';
import type {SimilarApiResponse} from './types';

type Props = {
  project: Project;
};

const DataConsentBanner = HookOrDefault({
  hookName: 'component:data-consent-banner',
  defaultComponent: null,
});

const LONG_STACKTRACE_PLATFORMS = ['go', 'javascript', 'node', 'php', 'python', 'ruby'];
const EMPTY_SET: ReadonlySet<string> = new Set();

export function SimilarStackTrace({project}: Props) {
  const api = useApi({persistInFlight: true});
  const location = useLocation();
  const organization = useOrganization();
  const params = useParams<{groupId: string; orgId: string}>();
  const navigate = useNavigate();

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const hasSimilarityFeature = project.features.includes('similarity-view');
  const {data: projectData, isPending: isProjectPending} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });
  // similarity-embeddings feature is only available on project details
  const hasEmbeddings =
    projectData?.features.includes('similarity-embeddings') ||
    location.query.similarityEmbeddings === '1';

  const canFetch = !isProjectPending && (hasSimilarityFeature || hasEmbeddings);

  const {
    data: result,
    isPending,
    isError,
    refetch,
  } = useQuery({
    ...apiOptions.as<SimilarApiResponse>()(
      hasEmbeddings
        ? '/organizations/$organizationIdOrSlug/issues/$issueId/similar-issues-embeddings/'
        : '/organizations/$organizationIdOrSlug/issues/$issueId/similar/',
      {
        path: canFetch
          ? {organizationIdOrSlug: organization.slug, issueId: params.groupId}
          : skipToken,
        query: hasEmbeddings ? {k: 10, threshold: 0.01} : {...location.query, limit: 50},
        staleTime: 0,
      }
    ),
    select: response => {
      const items = response.json.map(tuple => processSimilarItem(tuple, hasEmbeddings));
      return {
        similar: items.filter(item => !item.isBelowThreshold),
        filtered: items.filter(item => item.isBelowThreshold),
        pageLinks: response.headers.Link ?? null,
      };
    },
  });

  // During an in-flight merge, the ids being merged are frozen on the mutation's
  // `variables`; we derive the "busy" set from that instead of a second useState.
  const {
    mutate: mergeMutate,
    isPending: isMerging,
    variables,
  } = useMutation<
    {merge?: {parent?: string}} | undefined,
    Error,
    {ids: string[]; projectSlug: string; query?: string}
  >({
    mutationFn: ({ids, projectSlug, query}) =>
      new Promise((resolve, reject) => {
        mergeGroups(
          api,
          {
            orgId: organization.slug,
            projectId: projectSlug,
            itemIds: [...ids, params.groupId],
            query,
          },
          {
            success: (data: any) => resolve(data),
            error: (err: any) =>
              reject(err instanceof Error ? err : new Error('Failed to merge issues')),
          }
        );
      }),
    onSuccess: data => {
      if (data?.merge?.parent && data.merge.parent !== params.groupId) {
        navigate(
          `/organizations/${organization.slug}/issues/${data.merge.parent}/similar/`
        );
      }
      setCheckedIds(new Set());
    },
  });

  const busyIds = isMerging && variables ? new Set(variables.ids) : EMPTY_SET;
  const {similar = [], filtered = [], pageLinks = null} = result ?? {};

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
      query: location.query.query as string,
    });
  }, [checkedIds, similar, filtered, location.query, mergeMutate]);

  const {data: event, isPending: isEventPending} = useGroupEvent({
    groupId: params.groupId,
    eventId: 'latest',
  });
  const platformSupportsLongStacktraces = LONG_STACKTRACE_PLATFORMS.includes(
    event?.platform ?? ''
  );

  const loading = isPending || isProjectPending || isEventPending || !canFetch;

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
        emptyMessage={getEmptyMessage(hasEmbeddings, platformSupportsLongStacktraces)}
        items={similar}
        filteredItems={filtered}
        onMerge={handleMerge}
        onToggle={handleToggle}
        checkedIds={checkedIds}
        busyIds={busyIds}
        project={project}
        groupId={params.groupId}
        pageLinks={pageLinks}
        hasSimilarityEmbeddingsFeature={hasEmbeddings}
      />
      <DataConsentBanner source="grouping" />
    </Stack>
  );
}

function getEmptyMessage(
  hasEmbeddings: boolean,
  platformSupportsLongStacktraces: boolean
) {
  if (!platformSupportsLongStacktraces) {
    return t(
      'No similar issues found. This can happen when the issue has no stacktrace or in-app frames, or when the stacktrace has over 30 frames.'
    );
  }
  if (hasEmbeddings) {
    return t(
      'No similar issues found. This can happen when the issue has no stacktrace or in-app frames.'
    );
  }
  return t('No similar issues found.');
}
