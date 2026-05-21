import {lazy, useEffect, useRef} from 'react';
import {skipToken, useQueries, useQueryClient} from '@tanstack/react-query';

import {Flex} from '@sentry/scraps/layout';

import {isStacktraceNewestFirst} from 'sentry/components/events/interfaces/utils';
import {LazyLoad} from 'sentry/components/lazyLoad';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getStacktraceBody} from 'sentry/utils/getStacktraceBody';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

const SplitDiffLazy = lazy(() => import('../splitDiff'));
const STACKTRACE_SECTION_SEPARATOR = '\n\n';
const SKELETON_ROW_COUNT = 8;

interface IssueDiffProps {
  baseIssueId: string;
  targetIssueId: string;
  baseEventId?: string;
  hasSimilarityEmbeddingsProjectFeature?: boolean;
  shouldBeGrouped?: string;
  targetEventId?: string;
}

function getCombinedStacktrace({
  event,
  hasSimilarityEmbeddingsFeature,
  newestFirst,
}: {
  event: Event | undefined;
  hasSimilarityEmbeddingsFeature: boolean;
  newestFirst: boolean;
}): string {
  if (!event) {
    return '';
  }

  const stacktrace = getStacktraceBody({
    event,
    hasSimilarityEmbeddingsFeature,
    includeLocation: false,
    rawTrace: false,
    newestFirst,
    includeJSContext: true,
  });

  const orderedStacktrace = newestFirst ? stacktrace.toReversed() : stacktrace;
  return orderedStacktrace.join(STACKTRACE_SECTION_SEPARATOR);
}

export function IssueDiff({
  baseIssueId,
  targetIssueId,
  baseEventId = 'latest',
  targetEventId = 'latest',
  hasSimilarityEmbeddingsProjectFeature,
  shouldBeGrouped,
}: IssueDiffProps) {
  const organization = useOrganization();
  const location = useLocation();
  const queryClient = useQueryClient();
  const hasTrackedAnalytics = useRef(false);

  const hasSimilarityEmbeddingsFeature =
    hasSimilarityEmbeddingsProjectFeature || location.query.similarityEmbeddings === '1';

  const newestFirst = isStacktraceNewestFirst();

  // Build "latest" query options to resolve event IDs when 'latest' is passed
  const baseLatestQueryOptions = apiOptions.as<{eventID: string}>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/events/$eventId/',
    {
      path:
        baseEventId === 'latest'
          ? {
              organizationIdOrSlug: organization.slug,
              issueId: baseIssueId,
              eventId: 'latest',
            }
          : skipToken,
      staleTime: 60_000,
    }
  );

  const targetLatestQueryOptions = apiOptions.as<{eventID: string}>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/events/$eventId/',
    {
      path:
        targetEventId === 'latest'
          ? {
              organizationIdOrSlug: organization.slug,
              issueId: targetIssueId,
              eventId: 'latest',
            }
          : skipToken,
      staleTime: 60_000,
    }
  );

  // Resolve event IDs from cache (for "latest") or use the provided concrete IDs
  // This enables the actual event data queries to run once we know the IDs
  const cachedBaseLatest = queryClient.getQueryData(baseLatestQueryOptions.queryKey);
  const cachedTargetLatest = queryClient.getQueryData(targetLatestQueryOptions.queryKey);

  const resolvedBaseEventId =
    baseEventId === 'latest' ? cachedBaseLatest?.json?.eventID : baseEventId;
  const resolvedTargetEventId =
    targetEventId === 'latest' ? cachedTargetLatest?.json?.eventID : targetEventId;

  const {combinedBase, combinedTarget, isLoading, hasError, baseEventData, targetEventData} =
    useQueries({
      queries: [
        // Query 0: resolve "latest" base event ID (skipped if a concrete ID was passed)
        baseLatestQueryOptions,
        // Query 1: resolve "latest" target event ID (skipped if a concrete ID was passed)
        targetLatestQueryOptions,
        // Query 2: fetch actual base event data (skipped until ID is available)
        apiOptions.as<Event>()(
          '/organizations/$organizationIdOrSlug/issues/$issueId/events/$eventId/',
          {
            path: resolvedBaseEventId
              ? {
                  organizationIdOrSlug: organization.slug,
                  issueId: baseIssueId,
                  eventId: resolvedBaseEventId,
                }
              : skipToken,
            staleTime: 60_000,
          }
        ),
        // Query 3: fetch actual target event data (skipped until ID is available)
        apiOptions.as<Event>()(
          '/organizations/$organizationIdOrSlug/issues/$issueId/events/$eventId/',
          {
            path: resolvedTargetEventId
              ? {
                  organizationIdOrSlug: organization.slug,
                  issueId: targetIssueId,
                  eventId: resolvedTargetEventId,
                }
              : skipToken,
            staleTime: 60_000,
          }
        ),
      ],
      combine: ([baseLatest, targetLatest, baseEvent, targetEvent]) => ({
        isLoading: baseEvent.isPending || targetEvent.isPending,
        hasError:
          baseLatest.isError ||
          targetLatest.isError ||
          baseEvent.isError ||
          targetEvent.isError,
        baseEventData: baseEvent.data,
        targetEventData: targetEvent.data,
        combinedBase: getCombinedStacktrace({
          event: baseEvent.data,
          hasSimilarityEmbeddingsFeature,
          newestFirst,
        }),
        combinedTarget: getCombinedStacktrace({
          event: targetEvent.data,
          hasSimilarityEmbeddingsFeature,
          newestFirst,
        }),
      }),
    });

  useEffect(() => {
    if (
      hasTrackedAnalytics.current ||
      !organization ||
      !hasSimilarityEmbeddingsFeature ||
      !baseEventData ||
      !targetEventData
    ) {
      return;
    }

    hasTrackedAnalytics.current = true;
    trackAnalytics('issue_details.similar_issues.diff_clicked', {
      organization,
      project_id: baseEventData?.projectID,
      group_id: baseEventData?.groupID,
      parent_group_id: targetEventData?.groupID,
      shouldBeGrouped,
    });
  }, [
    baseEventData,
    hasSimilarityEmbeddingsFeature,
    organization,
    shouldBeGrouped,
    targetEventData,
  ]);

  if (hasError) {
    return (
      <Flex background="secondary" overflow="auto" padding="md" direction="column">
        <LoadingError message={t('Error loading events')} />
      </Flex>
    );
  }

  if (isLoading) {
    return <IssueDiffLoadingState />;
  }

  return (
    <Flex background="secondary" overflow="auto" padding="md" direction="column">
      <LazyLoad
        LazyComponent={SplitDiffLazy}
        base={combinedBase}
        target={combinedTarget}
        type="lines"
        loadingFallback={<IssueDiffLoadingSkeletonRows />}
      />
    </Flex>
  );
}

function IssueDiffLoadingState() {
  return (
    <Flex
      background="primary"
      overflow="auto"
      padding="md"
      direction="column"
      data-test-id="issue-diff-loading-skeleton"
    >
      <IssueDiffLoadingSkeletonRows />
    </Flex>
  );
}

function IssueDiffLoadingSkeletonRows() {
  return (
    <Flex direction="column" gap="sm">
      {Array.from({length: SKELETON_ROW_COUNT}).map((_, index) => (
        <Flex key={index} align="center">
          <Placeholder height="18px" style={{flex: 1}} />
          <Flex width="20px" flexShrink={0} />
          <Placeholder height="18px" style={{flex: 1}} />
        </Flex>
      ))}
    </Flex>
  );
}
