import {Fragment, useMemo} from 'react';

import {Tooltip} from 'sentry/components/core/tooltip';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t, tn} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import getDuration from 'sentry/utils/duration/getDuration';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useParams} from 'sentry/utils/useParams';
import type {TraceMetaQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import {
  type SectionCardKeyValueList,
  TraceDrawerComponents,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {isTraceNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {SpanTimeRenderer} from 'sentry/views/traces/fieldRenderers';

type GeneralInfoProps = {
  meta: TraceMetaQueryResults;
  node: TraceTreeNode<TraceTree.NodeValue>;
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  tree: TraceTree;
};

export function GeneralInfo(props: GeneralInfoProps) {
  const params = useParams<{traceSlug?: string}>();
  const {replay} = useReplayContext();

  const traceNode = props.tree.root.children[0];

  const uniqueErrorIssues = useMemo(() => {
    if (!traceNode) {
      return [];
    }

    const unique: TraceTree.TraceErrorIssue[] = [];
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

  const uniqueOccurences = useMemo(() => {
    if (!traceNode) {
      return [];
    }

    const unique: TraceTree.TraceOccurrence[] = [];
    const seenIssues: Set<number> = new Set();

    for (const issue of traceNode.occurrences) {
      if (seenIssues.has(issue.issue_id)) {
        continue;
      }
      seenIssues.add(issue.issue_id);
      unique.push(issue);
    }

    return unique;
  }, [traceNode]);

  const uniqueIssuesCount = uniqueErrorIssues.length + uniqueOccurences.length;

  const traceSlug = useMemo(() => {
    return params.traceSlug?.trim() ?? '';
  }, [params.traceSlug]);

  const isLoading = useMemo(() => {
    return (
      props.meta.status === 'pending' ||
      (props.rootEventResults.isPending && props.rootEventResults.fetchStatus !== 'idle')
    );
  }, [
    props.meta.status,
    props.rootEventResults.isPending,
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

  if (!(traceNode && isTraceNode(traceNode))) {
    throw new Error('Expected a trace node');
  }

  if (props.tree.transactions_count === 0) {
    return null;
  }

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
      value: props.meta.data
        ? props.meta.data.transactions + props.meta.data.errors
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
                    uniqueOccurences.length
                  )}
                </div>
              </Fragment>
            ) : null
          }
          showUnderline
          position="bottom"
        >
          {uniqueIssuesCount > 0 ? (
            <TraceDrawerComponents.IssuesLink node={props.node}>
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
      value:
        traceNode.space[1] > 0 ? (
          <SpanTimeRenderer timestamp={traceNode.space[0]} tooltipShowSeconds />
        ) : (
          '\u2014'
        ),
    },
    {
      key: 'total_duration',
      subject: t('Total Duration'),
      value:
        traceNode.space[1] > 0
          ? getDuration(traceNode.space[1] / 1e3, 2, true)
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

  return (
    <TraceDrawerComponents.SectionCard
      items={items}
      title={t('General')}
      disableTruncate
    />
  );
}
