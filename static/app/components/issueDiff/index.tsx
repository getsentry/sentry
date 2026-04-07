import {lazy, useEffect, useMemo, useRef} from 'react';
import {useQuery} from '@tanstack/react-query';

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
  const hasTrackedAnalytics = useRef(false);

  const hasSimilarityEmbeddingsFeature =
    hasSimilarityEmbeddingsProjectFeature || location.query.similarityEmbeddings === '1';

  const newestFirst = isStacktraceNewestFirst();

  const baseLatestQuery = useQuery({
    ...apiOptions.as<{eventID: string}>()(
      '/organizations/$organizationIdOrSlug/issues/$issueId/events/$eventId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          issueId: baseIssueId,
          eventId: 'latest',
        },
        staleTime: 60_000,
      }
    ),
    enabled: baseEventId === 'latest',
  });

  const targetLatestQuery = useQuery({
    ...apiOptions.as<{eventID: string}>()(
      '/organizations/$organizationIdOrSlug/issues/$issueId/events/$eventId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          issueId: targetIssueId,
          eventId: 'latest',
        },
        staleTime: 60_000,
      }
    ),
    enabled: targetEventId === 'latest',
  });

  const resolvedBaseEventId =
    baseEventId === 'latest' ? baseLatestQuery.data?.eventID : baseEventId;
  const resolvedTargetEventId =
    targetEventId === 'latest' ? targetLatestQuery.data?.eventID : targetEventId;

  const baseEventQuery = useQuery({
    ...apiOptions.as<Event>()(
      '/organizations/$organizationIdOrSlug/issues/$issueId/events/$eventId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          issueId: baseIssueId,
          eventId: resolvedBaseEventId ?? '',
        },
        staleTime: 60_000,
      }
    ),
    enabled: Boolean(resolvedBaseEventId),
  });

  const targetEventQuery = useQuery({
    ...apiOptions.as<Event>()(
      '/organizations/$organizationIdOrSlug/issues/$issueId/events/$eventId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          issueId: targetIssueId,
          eventId: resolvedTargetEventId ?? '',
        },
        staleTime: 60_000,
      }
    ),
    enabled: Boolean(resolvedTargetEventId),
  });

  const {combinedBase, combinedTarget} = useMemo(
    () => ({
      combinedBase: getCombinedStacktrace({
        event: baseEventQuery.data,
        hasSimilarityEmbeddingsFeature,
        newestFirst,
      }),
      combinedTarget: getCombinedStacktrace({
        event: targetEventQuery.data,
        hasSimilarityEmbeddingsFeature,
        newestFirst,
      }),
    }),
    [
      baseEventQuery.data,
      targetEventQuery.data,
      hasSimilarityEmbeddingsFeature,
      newestFirst,
    ]
  );

  useEffect(() => {
    if (
      hasTrackedAnalytics.current ||
      !organization ||
      !hasSimilarityEmbeddingsFeature ||
      !baseEventQuery.data ||
      !targetEventQuery.data
    ) {
      return;
    }

    hasTrackedAnalytics.current = true;
    trackAnalytics('issue_details.similar_issues.diff_clicked', {
      organization,
      project_id: baseEventQuery.data?.projectID,
      group_id: baseEventQuery.data?.groupID,
      parent_group_id: targetEventQuery.data?.groupID,
      shouldBeGrouped,
    });
  }, [
    baseEventQuery.data,
    hasSimilarityEmbeddingsFeature,
    organization,
    shouldBeGrouped,
    targetEventQuery.data,
  ]);

  const hasError =
    baseLatestQuery.isError ||
    targetLatestQuery.isError ||
    baseEventQuery.isError ||
    targetEventQuery.isError;

  const isLoading = baseEventQuery.isPending || targetEventQuery.isPending;

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
