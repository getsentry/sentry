import {Fragment, useMemo} from 'react';

import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tn} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import getDuration from 'sentry/utils/duration/getDuration';
import {getShortEventId} from 'sentry/utils/events';
import type {
  TraceErrorOrIssue,
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useParams} from 'sentry/utils/useParams';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {SpanTimeRenderer} from 'sentry/views/traces/fieldRenderers';

import {isTraceNode} from '../../../guards';
import type {TraceMetaQueryResults} from '../../../traceApi/useTraceMeta';
import type {TraceTree, TraceTreeNode} from '../../../traceModels/traceTree';
import {type SectionCardKeyValueList, TraceDrawerComponents} from '../../details/styles';

type GeneralInfoProps = {
  metaResults: TraceMetaQueryResults;
  node: TraceTreeNode<TraceTree.NodeValue> | null;
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  traces: TraceSplitResults<TraceFullDetailed> | null;
  tree: TraceTree;
};

export function GeneralInfo(props: GeneralInfoProps) {
  const params = useParams<{traceSlug?: string}>();
  const {replay} = useReplayContext();

  const uniqueErrorIssues = useMemo(() => {
    if (!props.node) {
      return [];
    }

    const unique: TraceErrorOrIssue[] = [];
    const seenIssues: Set<number> = new Set();

    for (const issue of props.node.errors) {
      if (seenIssues.has(issue.issue_id)) {
        continue;
      }
      seenIssues.add(issue.issue_id);
      unique.push(issue);
    }

    return unique;
  }, [props.node]);

  const uniquePerformanceIssues = useMemo(() => {
    if (!props.node) {
      return [];
    }

    const unique: TraceErrorOrIssue[] = [];
    const seenIssues: Set<number> = new Set();

    for (const issue of props.node.performance_issues) {
      if (seenIssues.has(issue.issue_id)) {
        continue;
      }
      seenIssues.add(issue.issue_id);
      unique.push(issue);
    }

    return unique;
  }, [props.node]);

  const uniqueIssuesCount = uniqueErrorIssues.length + uniquePerformanceIssues.length;

  const traceSlug = useMemo(() => {
    return params.traceSlug?.trim() ?? '';
  }, [params.traceSlug]);

  const isLoading = useMemo(() => {
    return (
      props.metaResults.isLoading ||
      (props.rootEventResults.isLoading && props.rootEventResults.fetchStatus !== 'idle')
    );
  }, [
    props.metaResults.isLoading,
    props.rootEventResults.isLoading,
    props.rootEventResults.fetchStatus,
  ]);

  if (isLoading) {
    return (
      <TraceDrawerComponents.SectionCard
        items={[
          {
            key: 'trace_general_loading',
            subject: t('Loading...'),
            subjectNode: null,
            value: <LoadingIndicator size={30} />,
          },
        ]}
        title={t('General')}
      />
    );
  }

  if (!props.node || !isTraceNode(props.node)) {
    throw new Error('Expected a trace node');
  }

  if (
    props.traces?.transactions.length === 0 &&
    props.traces.orphan_errors.length === 0
  ) {
    return null;
  }

  const replay_id = props.rootEventResults?.data?.contexts?.replay?.replay_id;
  const browser = props.rootEventResults?.data?.contexts?.browser;

  const items: SectionCardKeyValueList = [];

  // Hide trace_id inside replays because a replay could be connected to multiple traces.
  if (!replay) {
    items.push({
      key: 'trace_id',
      subject: t('Trace ID'),
      value: <TraceDrawerComponents.CopyableCardValueWithLink value={traceSlug} />,
    });
  }

  items.push(
    {
      key: 'events',
      subject: t('Events'),
      value: props.metaResults.data
        ? props.metaResults.data.transactions + props.metaResults.data.errors
        : '\u2014',
    },
    {
      key: 'issues',
      subject: t('Issues'),
      value: (
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
          {uniqueIssuesCount > 0 ? (
            <TraceDrawerComponents.IssuesLink>
              {uniqueIssuesCount}
            </TraceDrawerComponents.IssuesLink>
          ) : uniqueIssuesCount === 0 ? (
            0
          ) : (
            '\u2014'
          )}
        </Tooltip>
      ),
    },
    {
      key: 'start_timestamp',
      subject: t('Start Timestamp'),
      value: props.node.space?.[1] ? (
        <SpanTimeRenderer timestamp={props.node.space?.[0]} tooltipShowSeconds />
      ) : (
        '\u2014'
      ),
    },
    {
      key: 'total_duration',
      subject: t('Total Duration'),
      value: props.node.space?.[1]
        ? getDuration(props.node.space[1] / 1000, 2, true)
        : '\u2014',
    },
    {
      key: 'user',
      subject: t('User'),
      value:
        props.rootEventResults?.data?.user?.email ??
        props.rootEventResults?.data?.user?.name ??
        '\u2014',
    },
    {
      key: 'browser',
      subject: t('Browser'),
      value: browser ? browser.name + ' ' + browser.version : '\u2014',
    }
  );

  // Hide replay preview if we are already in a replay page.
  if (replay_id && !replay) {
    items.push({
      key: 'replay_id',
      subject: t('Replay ID'),
      value: (
        <Link
          to={normalizeUrl(
            `/organizations/${props.organization.slug}/replays/${replay_id}/`
          )}
        >
          {getShortEventId(replay_id)}
        </Link>
      ),
    });
  }

  return (
    <TraceDrawerComponents.SectionCard
      items={items}
      title={t('General')}
      disableTruncate
    />
  );
}
