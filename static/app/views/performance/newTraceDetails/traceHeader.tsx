import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {IconPlay} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction, Organization} from 'sentry/types';
import getDuration from 'sentry/utils/duration/getDuration';
import {getShortEventId} from 'sentry/utils/events';
import type {
  TraceErrorOrIssue,
  TraceFullDetailed,
  TraceMeta,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {BrowserDisplay} from '../transactionDetails/eventMetas';
import {MetaData} from '../transactionDetails/styles';

import {TraceDrawerComponents} from './traceDrawer/details/styles';
import type {TraceTree} from './traceModels/traceTree';
import {isTraceNode} from './guards';

function TraceHeaderEmptyTrace() {
  return (
    <TraceHeaderContainer>
      <TraceHeaderRow textAlign="left">
        <MetaData
          headingText={t('User')}
          tooltipText=""
          bodyText={'\u2014'}
          subtext={null}
        />
        <MetaData
          headingText={t('Browser')}
          tooltipText=""
          bodyText={'\u2014'}
          subtext={null}
        />
      </TraceHeaderRow>
      <TraceHeaderRow textAlign="right">
        <GuideAnchor target="trace_view_guide_breakdown">
          <MetaData
            headingText={t('Events')}
            tooltipText=""
            bodyText={'\u2014'}
            subtext={null}
          />
        </GuideAnchor>
        <MetaData
          headingText={t('Issues')}
          tooltipText=""
          bodyText={'\u2014'}
          subtext={null}
        />
        <MetaData
          headingText={t('Total Duration')}
          tooltipText=""
          bodyText={'\u2014'}
          subtext={null}
        />
      </TraceHeaderRow>
    </TraceHeaderContainer>
  );
}

type TraceHeaderProps = {
  metaResults: UseApiQueryResult<TraceMeta | null, any>;
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  traceID: string | undefined;
  traces: TraceSplitResults<TraceFullDetailed> | null;
  tree: TraceTree;
};

export function TraceHeader({
  metaResults,
  rootEventResults,
  traces,
  organization,
  tree,
  traceID,
}: TraceHeaderProps) {
  const traceNode = tree.root.children[0];

  const replay_id = rootEventResults?.data?.contexts?.replay?.replay_id;
  const showLoadingIndicator =
    (rootEventResults.isLoading && rootEventResults.fetchStatus !== 'idle') ||
    metaResults.isLoading;

  const uniqueErrorIssues = useMemo(() => {
    if (!traceNode) {
      return [];
    }

    const unique: TraceErrorOrIssue[] = [];

    const seenIssues: Set<number> = new Set();

    for (const issue of traceNode.errors) {
      if (seenIssues.has(issue.issue_id)) {
        continue;
      }
      seenIssues.add(issue.issue_id);
      unique.push(issue);
    }

    return unique;
  }, [traceNode]);

  const uniquePerformanceIssues = useMemo(() => {
    if (!traceNode) {
      return [];
    }

    const unique: TraceErrorOrIssue[] = [];
    const seenIssues: Set<number> = new Set();

    for (const issue of traceNode.performance_issues) {
      if (seenIssues.has(issue.issue_id)) {
        continue;
      }
      seenIssues.add(issue.issue_id);
      unique.push(issue);
    }

    return unique;
  }, [traceNode]);

  const uniqueIssuesCount = uniqueErrorIssues.length + uniquePerformanceIssues.length;

  if (traces?.transactions.length === 0 && traces.orphan_errors.length === 0) {
    return <TraceHeaderEmptyTrace />;
  }

  if (!(traceNode && isTraceNode(traceNode))) {
    throw new Error('Expected a trace node');
  }

  return (
    <TraceHeaderContainer>
      <TraceHeaderRow textAlign="left">
        <MetaData
          headingText={t('User')}
          tooltipText=""
          bodyText={
            showLoadingIndicator ? (
              <LoadingIndicator size={20} mini />
            ) : (
              rootEventResults?.data?.user?.email ??
              rootEventResults?.data?.user?.name ??
              '\u2014'
            )
          }
          subtext={null}
        />
        <MetaData
          headingText={t('Browser')}
          tooltipText=""
          bodyText={
            showLoadingIndicator ? (
              <LoadingIndicator size={20} mini />
            ) : rootEventResults?.data ? (
              <BrowserDisplay event={rootEventResults?.data} showVersion />
            ) : (
              '\u2014'
            )
          }
          subtext={null}
        />
        <MetaData
          headingText={t('Trace')}
          tooltipText=""
          bodyText={
            showLoadingIndicator ? (
              <LoadingIndicator size={20} mini />
            ) : traceID ? (
              <Fragment>
                {getShortEventId(traceID)}
                <CopyToClipboardButton
                  borderless
                  size="zero"
                  iconSize="xs"
                  text={traceID}
                />
              </Fragment>
            ) : (
              '\u2014'
            )
          }
          subtext={null}
        />
        {replay_id && (
          <MetaData
            headingText={t('Replay')}
            tooltipText=""
            bodyText={
              <Link
                to={normalizeUrl(
                  `/organizations/${organization.slug}/replays/${replay_id}/`
                )}
              >
                <ReplayLinkBody>
                  {getShortEventId(replay_id)}
                  <IconPlay size="xs" />
                </ReplayLinkBody>
              </Link>
            }
            subtext={null}
          />
        )}
      </TraceHeaderRow>
      <TraceHeaderRow textAlign="right">
        <GuideAnchor target="trace_view_guide_breakdown">
          <MetaData
            headingText={t('Events')}
            tooltipText=""
            bodyText={
              metaResults.isLoading ? (
                <LoadingIndicator size={20} mini />
              ) : metaResults.data ? (
                metaResults.data.transactions + metaResults.data.errors
              ) : (
                '\u2014'
              )
            }
            subtext={null}
          />
        </GuideAnchor>
        <MetaData
          headingText={t('Issues')}
          tooltipText=""
          bodyText={
            <Tooltip
              title={
                uniqueIssuesCount > 0 ? (
                  <Fragment>
                    <div>
                      {tn('%s error issue', '%s error issues', uniqueErrorIssues.length)}
                    </div>
                    <div>
                      {tn(
                        '%s performance issue',
                        '%s performance issues',
                        uniquePerformanceIssues.length
                      )}
                    </div>
                  </Fragment>
                ) : null
              }
              showUnderline
              position="bottom"
            >
              {metaResults.isLoading ? (
                <LoadingIndicator size={20} mini />
              ) : uniqueIssuesCount > 0 ? (
                <TraceDrawerComponents.IssuesLink>
                  {uniqueIssuesCount}
                </TraceDrawerComponents.IssuesLink>
              ) : (
                '\u2014'
              )}
            </Tooltip>
          }
          subtext={null}
        />
        <MetaData
          headingText={t('Total Duration')}
          tooltipText=""
          bodyText={
            metaResults.isLoading ? (
              <LoadingIndicator size={20} mini />
            ) : traceNode.space?.[1] ? (
              getDuration(traceNode.space[1] / 1000, 2, true)
            ) : (
              '\u2014'
            )
          }
          subtext={null}
        />
      </TraceHeaderRow>
    </TraceHeaderContainer>
  );
}

const FlexBox = styled('div')`
  display: flex;
  align-items: center;
`;

const TraceHeaderContainer = styled(FlexBox)`
  justify-content: space-between;
  background-color: ${p => p.theme.background};
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
`;

const TraceHeaderRow = styled(FlexBox)<{textAlign: 'left' | 'right'}>`
  gap: ${space(2)};
  text-align: ${p => p.textAlign};
`;

const ReplayLinkBody = styled(FlexBox)`
  gap: ${space(0.25)};
`;
