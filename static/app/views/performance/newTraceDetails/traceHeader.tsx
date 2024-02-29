import {Fragment} from 'react';
import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {IconPlay} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction, Organization} from 'sentry/types';
import {getShortEventId} from 'sentry/utils/events';
import {getDuration} from 'sentry/utils/formatters';
import type {TraceMetaQueryChildrenProps} from 'sentry/utils/performance/quickTrace/traceMetaQuery';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {getTraceInfo} from '../traceDetails/utils';
import {BrowserDisplay} from '../transactionDetails/eventMetas';
import {MetaData} from '../transactionDetails/styles';

type TraceHeaderProps = {
  metaResults: TraceMetaQueryChildrenProps;
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  traces: TraceSplitResults<TraceFullDetailed> | null;
};

export default function TraceHeader(props: TraceHeaderProps) {
  const {metaResults, rootEventResults, traces, organization} = props;
  const {meta, isLoading: metaLoading} = metaResults;
  const {data: rootEvent, isLoading: rootEventLoading} = rootEventResults;
  const emptyTrace =
    traces?.transactions &&
    traces?.transactions.length === 0 &&
    traces?.orphan_errors &&
    traces.orphan_errors.length === 0;
  const showLoadingIndicator = rootEventLoading && !emptyTrace;
  const errors = meta?.errors || 0;
  const performanceIssues = meta?.performance_issues || 0;
  const replay_id = rootEvent?.contexts.replay?.replay_id ?? '';
  const traceInfo = getTraceInfo(traces?.transactions, traces?.orphan_errors);
  const loadingIndicator = <LoadingIndicator size={20} mini />;

  return (
    <TraceHeaderContainer>
      <TraceHeaderRow>
        <MetaData
          headingText={t('User')}
          tooltipText=""
          bodyText={
            showLoadingIndicator
              ? loadingIndicator
              : rootEvent?.user?.email ?? rootEvent?.user?.name ?? '\u2014'
          }
          subtext={null}
        />
        <MetaData
          headingText={t('Browser')}
          tooltipText=""
          bodyText={
            showLoadingIndicator ? (
              loadingIndicator
            ) : rootEvent ? (
              <BrowserDisplay event={rootEvent} showVersion />
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
      <TraceHeaderRow>
        <GuideAnchor target="trace_view_guide_breakdown">
          <MetaData
            headingText={t('Events')}
            tooltipText=""
            bodyText={
              metaLoading
                ? loadingIndicator
                : meta
                  ? meta.transactions + meta.errors
                  : '\u2014'
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
                errors + performanceIssues > 0 ? (
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
              {metaLoading
                ? loadingIndicator
                : errors || performanceIssues
                  ? errors + performanceIssues
                  : 0}
            </Tooltip>
          }
          subtext={null}
        />
        <MetaData
          headingText={t('Total Duration')}
          tooltipText=""
          bodyText={
            emptyTrace
              ? getDuration(0, 2, true)
              : traceInfo.startTimestamp && traceInfo.endTimestamp
                ? getDuration(traceInfo.endTimestamp - traceInfo.startTimestamp, 2, true)
                : loadingIndicator
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

const TraceHeaderRow = styled(FlexBox)`
  gap: ${space(2)};
`;

const ReplayLinkBody = styled(FlexBox)`
  gap: ${space(0.25)};
`;
