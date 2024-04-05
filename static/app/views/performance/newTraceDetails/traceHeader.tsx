import {Fragment} from 'react';
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
import {getShortEventId} from 'sentry/utils/events';
import {getDuration} from 'sentry/utils/formatters';
import type {
  TraceFullDetailed,
  TraceMeta,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {BrowserDisplay} from '../transactionDetails/eventMetas';
import {MetaData} from '../transactionDetails/styles';

import {isTraceNode} from './guards';
import type {TraceTree} from './traceTree';

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
  if (traces?.transactions.length === 0 && traces.orphan_errors.length === 0) {
    return <TraceHeaderEmptyTrace />;
  }

  const traceNode = tree.root.children[0];

  if (!(traceNode && isTraceNode(traceNode))) {
    throw new Error('Expected a trace node');
  }

  const errors = traceNode.errors.size || metaResults.data?.errors || 0;
  const performanceIssues =
    traceNode.performance_issues.size || metaResults.data?.performance_issues || 0;
  const errorsAndIssuesCount = errors + performanceIssues;

  const replay_id = rootEventResults?.data?.contexts.replay?.replay_id;
  const showLoadingIndicator =
    (rootEventResults.isLoading && rootEventResults.fetchStatus !== 'idle') ||
    metaResults.isLoading;

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
                errorsAndIssuesCount > 0 ? (
                  <Fragment>
                    <div>{tn('%s error issue', '%s error issues', errors)}</div>
                    <div>
                      {tn(
                        '%s performance issue',
                        '%s performance issues',
                        performanceIssues
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
              ) : errorsAndIssuesCount >= 0 ? (
                errorsAndIssuesCount
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
`;

const TraceHeaderRow = styled(FlexBox)<{textAlign: 'left' | 'right'}>`
  gap: ${space(2)};
  text-align: ${p => p.textAlign};
`;

const ReplayLinkBody = styled(FlexBox)`
  gap: ${space(0.25)};
`;
