import {lazy, useEffect, useRef} from 'react';
import {skipToken, useQueries} from '@tanstack/react-query';

import {Flex, Stack} from '@sentry/scraps/layout';

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
  const hasTrackedAnalytics = useRef(false);

  const hasSimilarityEmbeddingsFeature =
    hasSimilarityEmbeddingsProjectFeature || location.query.similarityEmbeddings === '1';

  const newestFirst = isStacktraceNewestFirst();

  // Resolve "latest" to concrete event IDs (skipped if concrete IDs were passed)
  const [baseLatestQuery, targetLatestQuery] = useQueries({
    queries: [
      apiOptions.as<{eventID: string}>()(
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
      ),
      apiOptions.as<{eventID: string}>()(
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
      ),
    ],
  });

  // Derive resolved IDs reactively from the query results
  const resolvedBaseEventId =
    baseEventId === 'latest' ? baseLatestQuery.data?.eventID : baseEventId;
  const resolvedTargetEventId =
    targetEventId === 'latest' ? targetLatestQuery.data?.eventID : targetEventId;

  // Fetch actual event data once IDs are resolved
  const {
    combinedBase,
    combinedTarget,
    isLoading,
    hasError,
    baseEventData,
    targetEventData,
  } = useQueries({
    queries: [
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
    combine: ([baseEvent, targetEvent]) => ({
      isLoading: baseEvent.isPending || targetEvent.isPending,
      hasError:
        baseLatestQuery.isError ||
        targetLatestQuery.isError ||
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
      <Stack background="secondary" overflow="auto" padding="md">
        <LoadingError message={t('Error loading events')} />
      </Stack>
    );
  }

  if (isLoading) {
    return <IssueDiffLoadingState />;
  }

  return (
    <Stack background="secondary" overflow="auto" padding="md">
      <LazyLoad
        LazyComponent={SplitDiffLazy}
        base={combinedBase}
        target={combinedTarget}
        type="lines"
        loadingFallback={<IssueDiffLoadingSkeletonRows />}
      />
    </Stack>
  );
}

function IssueDiffLoadingState() {
  return (
    <Stack
      background="primary"
      overflow="auto"
      padding="md"
      data-test-id="issue-diff-loading-skeleton"
    >
      <IssueDiffLoadingSkeletonRows />
    </Stack>
  );
}

function IssueDiffLoadingSkeletonRows() {
  return (
    <Stack gap="sm">
      {Array.from({length: SKELETON_ROW_COUNT}).map((_, index) => (
        <Flex key={index} align="center">
          <Placeholder height="18px" style={{flex: 1}} />
          <Flex width="20px" flexShrink={0} />
          <Placeholder height="18px" style={{flex: 1}} />
        </Flex>
      ))}
    </Stack>
  );
}
