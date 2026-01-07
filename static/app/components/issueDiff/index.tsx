import {lazy, useEffect, useMemo, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {isStacktraceNewestFirst} from 'sentry/components/events/interfaces/utils';
import LazyLoad from 'sentry/components/lazyLoad';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import getStacktraceBody from 'sentry/utils/getStacktraceBody';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const SplitDiffLazy = lazy(() => import('../splitDiff'));

interface IssueDiffProps {
  baseIssueId: string;
  targetIssueId: string;
  baseEventId?: string;
  hasSimilarityEmbeddingsProjectFeature?: boolean;
  shouldBeGrouped?: string;
  targetEventId?: string;
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
    ...apiOptions.as<{eventID: string}>()('/issues/$issueId/events/$eventId/', {
      path: {
        issueId: baseIssueId,
        eventId: 'latest',
      },
      staleTime: 60_000,
    }),
    enabled: baseEventId === 'latest',
  });

  const targetLatestQuery = useQuery({
    ...apiOptions.as<{eventID: string}>()('/issues/$issueId/events/$eventId/', {
      path: {
        issueId: targetIssueId,
        eventId: 'latest',
      },
      staleTime: 60_000,
    }),
    enabled: targetEventId === 'latest',
  });

  const resolvedBaseEventId =
    baseEventId === 'latest' ? baseLatestQuery.data?.eventID : baseEventId;
  const resolvedTargetEventId =
    targetEventId === 'latest' ? targetLatestQuery.data?.eventID : targetEventId;

  const baseEventQuery = useQuery({
    ...apiOptions.as<Event>()('/issues/$issueId/events/$eventId/', {
      path: {
        issueId: baseIssueId,
        eventId: resolvedBaseEventId ?? '',
      },
      staleTime: 60_000,
    }),
    enabled: Boolean(resolvedBaseEventId),
  });

  const targetEventQuery = useQuery({
    ...apiOptions.as<Event>()('/issues/$issueId/events/$eventId/', {
      path: {
        issueId: targetIssueId,
        eventId: resolvedTargetEventId ?? '',
      },
      staleTime: 60_000,
    }),
    enabled: Boolean(resolvedTargetEventId),
  });

  const baseStacktrace = useMemo(() => {
    if (!baseEventQuery.data) {
      return [];
    }
    return getStacktraceBody({
      event: baseEventQuery.data,
      hasSimilarityEmbeddingsFeature,
      includeLocation: false,
      rawTrace: false,
      newestFirst,
      includeJSContext: true,
    });
  }, [baseEventQuery.data, hasSimilarityEmbeddingsFeature, newestFirst]);

  const targetStacktrace = useMemo(() => {
    if (!targetEventQuery.data) {
      return [];
    }

    return getStacktraceBody({
      event: targetEventQuery.data,
      hasSimilarityEmbeddingsFeature,
      includeLocation: false,
      rawTrace: false,
      newestFirst,
      includeJSContext: true,
    });
  }, [targetEventQuery.data, hasSimilarityEmbeddingsFeature, newestFirst]);

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

  const baseArray = useMemo(() => {
    return newestFirst ? baseStacktrace.toReversed() : baseStacktrace;
  }, [baseStacktrace, newestFirst]);

  const targetArray = useMemo(() => {
    return newestFirst ? targetStacktrace.toReversed() : targetStacktrace;
  }, [newestFirst, targetStacktrace]);

  const hasError =
    baseLatestQuery.isError ||
    targetLatestQuery.isError ||
    baseEventQuery.isError ||
    targetEventQuery.isError;

  const loading = baseEventQuery.isPending || targetEventQuery.isPending;

  if (hasError) {
    return (
      <StyledIssueDiff isLoading={false}>
        <LoadingError message={t('Error loading events')} />
      </StyledIssueDiff>
    );
  }

  return (
    <StyledIssueDiff isLoading={loading}>
      {loading && <LoadingIndicator />}
      {!loading &&
        baseArray.map((value: string, index: number) => (
          <LazyLoad
            key={index}
            LazyComponent={SplitDiffLazy}
            base={value}
            target={targetArray[index] ?? ''}
            type="lines"
          />
        ))}
    </StyledIssueDiff>
  );
}

const StyledIssueDiff = styled('div')<{isLoading: boolean}>`
  background-color: ${p => p.theme.backgroundSecondary};
  overflow: auto;
  padding: ${p => p.theme.space.md};
  flex: 1;
  display: flex;
  flex-direction: column;

  ${p =>
    p.isLoading &&
    css`
      background-color: ${p.theme.tokens.background.primary};
      justify-content: center;
      align-items: center;
    `};
`;
