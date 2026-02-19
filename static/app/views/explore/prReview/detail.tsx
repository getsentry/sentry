import {Fragment, useState} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {DateTime} from 'sentry/components/dateTime';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {ScoreCard} from 'sentry/components/scoreCard';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconOpen} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {
  CodeReviewEvent,
  CodeReviewPRDetails,
} from 'sentry/views/explore/prReview/types';
import {
  formatDurationMs,
  formatStatus,
  prStateToTagVariant,
  statusToTagVariant,
} from 'sentry/views/explore/prReview/utils';

const PIPELINE_STAGES = [
  {key: 'triggerAt', label: t('Trigger')},
  {key: 'webhookReceivedAt', label: t('Webhook Received')},
  {key: 'preflightCompletedAt', label: t('Preflight')},
  {key: 'taskEnqueuedAt', label: t('Enqueued')},
  {key: 'sentToSeerAt', label: t('Sent to Seer')},
  {key: 'reviewStartedAt', label: t('Review Started')},
  {key: 'reviewCompletedAt', label: t('Review Completed')},
] as const;

export default function PrReviewDetail() {
  const organization = useOrganization();
  const {repoId, prNumber} = useParams<{prNumber: string; repoId: string}>();

  const {data: pr, isLoading} = useApiQuery<CodeReviewPRDetails>(
    [`/organizations/${organization.slug}/code-review-prs/${repoId}/${prNumber}/`],
    {staleTime: 30_000}
  );

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (!pr) {
    return null;
  }

  const title = pr.prTitle ?? `PR #${pr.prNumber}`;
  const subtitle = pr.prAuthor;

  return (
    <SentryDocumentTitle title={title} orgSlug={organization.slug}>
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  to: `/organizations/${organization.slug}/explore/pr-review/`,
                  label: t('PR Reviews'),
                  preservePageFilters: true,
                },
                {label: pr.repositoryName ?? pr.repositoryId},
                {label: `#${pr.prNumber}`},
              ]}
            />
            <Layout.Title>
              {title}
              {pr.prState ? (
                <Tag variant={prStateToTagVariant(pr.prState)}>
                  {formatStatus(pr.prState)}
                </Tag>
              ) : null}
            </Layout.Title>
            {subtitle && (
              <Text variant="muted" size="sm">
                {t('Author: %s', subtitle)}
              </Text>
            )}
          </Layout.HeaderContent>
          {pr.prUrl ? (
            <Layout.HeaderActions>
              <LinkButton href={pr.prUrl} external size="sm" icon={<IconOpen />}>
                {t('View on GitHub')}
              </LinkButton>
            </Layout.HeaderActions>
          ) : null}
        </Layout.Header>
        <Layout.Body>
          <Layout.Main width="full">
            <Flex direction="column" gap="lg">
              <PRDetailsSection pr={pr} />
              <SummaryCards pr={pr} />
              <ReviewEventsSection pr={pr} />
            </Flex>
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

function PRDetailsSection({pr}: {pr: CodeReviewPRDetails}) {
  const timeSpan = getTimeSpan(pr.events);

  return (
    <Flex gap="md" align="center" wrap="wrap">
      {timeSpan && (
        <Text variant="muted" size="sm">
          {t('Activity:')} <DateTime date={timeSpan.first} /> {' → '}
          <DateTime date={timeSpan.last} />
        </Text>
      )}
      <Text variant="muted" size="sm">
        {tn('%s event', '%s events', pr.events.length)}
      </Text>
    </Flex>
  );
}

function SummaryCards({pr}: {pr: CodeReviewPRDetails}) {
  const {summary} = pr;

  const failedTrend =
    summary.totalFailed > 0
      ? tn('%s failed', '%s failed', summary.totalFailed)
      : undefined;

  return (
    <Flex gap="md" wrap="wrap">
      <ScoreCard
        title={t('Reviews')}
        score={summary.totalReviews}
        trend={failedTrend}
        trendStatus={summary.totalFailed > 0 ? 'bad' : undefined}
      />
      <ScoreCard title={t('Comments')} score={summary.totalComments} />
      <ScoreCard
        title={t('Avg Review Time')}
        score={
          summary.avgReviewDurationMs === null
            ? undefined
            : formatDurationMs(summary.avgReviewDurationMs)
        }
      />
    </Flex>
  );
}

function ReviewEventsSection({pr}: {pr: CodeReviewPRDetails}) {
  const sortedEvents = [...pr.events].reverse(); // chronological order

  return (
    <Flex direction="column" gap="sm">
      <Heading as="h3">{t('Review Events')}</Heading>
      <PanelTable
        headers={[
          t('Trigger'),
          t('Status'),
          t('Trigger User'),
          t('Commit'),
          t('Time'),
          t('Comments'),
          t('Details'),
        ]}
        isEmpty={sortedEvents.length === 0}
        emptyMessage={t('No review events found.')}
      >
        {sortedEvents.map(event => (
          <EventRow key={event.id} event={event} prUrl={pr.prUrl} />
        ))}
      </PanelTable>
    </Flex>
  );
}

function EventRow({event, prUrl}: {event: CodeReviewEvent; prUrl: string | null}) {
  const [expanded, setExpanded] = useState(false);
  const commitShort = event.targetCommitSha?.slice(0, 7) ?? null;
  const commitUrl =
    prUrl && event.targetCommitSha ? buildCommitUrl(prUrl, event.targetCommitSha) : null;

  const showDenialReason =
    (event.status === 'preflight_denied' || event.status === 'webhook_filtered') &&
    event.denialReason;

  return (
    <Fragment>
      <div>{event.trigger ? formatStatus(event.trigger) : '—'}</div>
      <div>
        <Flex gap="xs" align="center" wrap="wrap">
          <Tag variant={statusToTagVariant(event.status)}>
            {formatStatus(event.status)}
          </Tag>
          {showDenialReason && (
            <Text variant="muted" size="sm">
              {formatStatus(event.denialReason!)}
            </Text>
          )}
        </Flex>
      </div>
      <div>{event.triggerUser ?? '—'}</div>
      <div>
        {commitShort ? (
          <Text size="sm" monospace>
            {commitUrl ? (
              <ExternalLink href={commitUrl}>{commitShort}</ExternalLink>
            ) : (
              commitShort
            )}
          </Text>
        ) : (
          '—'
        )}
      </div>
      <div>
        <DateTime date={event.triggerAt} seconds />
      </div>
      <div>{event.commentsPosted ?? '—'}</div>
      <div>
        <Disclosure size="xs" expanded={expanded} onExpandedChange={setExpanded}>
          <Disclosure.Title>{t('Timeline')}</Disclosure.Title>
          <Disclosure.Content>
            <PipelineTimeline event={event} />
          </Disclosure.Content>
        </Disclosure>
      </div>
    </Fragment>
  );
}

function PipelineTimeline({event}: {event: CodeReviewEvent}) {
  const lastReachedIndex = PIPELINE_STAGES.findLastIndex(stage => event[stage.key]);

  return (
    <Flex direction="column" gap="xs" padding="sm">
      {PIPELINE_STAGES.map((stage, index) => {
        const timestamp = event[stage.key];
        const reached = timestamp !== null && timestamp !== undefined;
        const isFinal = index === lastReachedIndex;

        return (
          <Flex key={stage.key} gap="sm" align="center">
            <Text
              size="sm"
              bold={isFinal}
              variant={reached ? undefined : 'muted'}
              style={{minWidth: 140}}
            >
              {reached ? '●' : '○'} {stage.label}
            </Text>
            {reached ? (
              <Text size="sm" variant="muted">
                <DateTime date={timestamp} seconds />
              </Text>
            ) : null}
          </Flex>
        );
      })}
    </Flex>
  );
}

function getTimeSpan(events: CodeReviewEvent[]): {first: string; last: string} | null {
  if (events.length === 0) {
    return null;
  }
  const times = events.map(e => e.triggerAt).sort();
  return {first: times[0]!, last: times[times.length - 1]!};
}

/** e.g. "https://github.com/owner/repo/pull/123" + "abc123" -> ".../commit/abc123" */
function buildCommitUrl(prUrl: string, commitSha: string): string | null {
  const match = prUrl.match(/^(https:\/\/github\.com\/[^/]+\/[^/]+)\//);
  if (!match) {
    return null;
  }
  return `${match[1]}/commit/${commitSha}`;
}
