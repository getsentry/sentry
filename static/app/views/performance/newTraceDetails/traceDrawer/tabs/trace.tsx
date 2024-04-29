import {Fragment, useMemo} from 'react';

import type {Tag} from 'sentry/actionCreators/events';
import type {EventTransaction} from 'sentry/types/event';
import {generateQueryWithTag} from 'sentry/utils';
import type EventView from 'sentry/utils/discover/eventView';
import {formatTagKey} from 'sentry/utils/discover/fields';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import Tags from 'sentry/views/discover/tags';
import {TraceWarnings} from 'sentry/views/performance/newTraceDetails/traceWarnings';
import type {TraceType} from 'sentry/views/performance/traceDetails/newTraceDetailsContent';

import {isTraceNode} from '../../guards';
import type {TraceTree, TraceTreeNode} from '../../traceModels/traceTree';
import {IssueList} from '../details/issues/issues';

type TraceDetailsProps = {
  node: TraceTreeNode<TraceTree.NodeValue> | null;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  tagsQueryResults: UseApiQueryResult<Tag[], RequestError>;
  traceEventView: EventView;
  traceType: TraceType;
  traces: TraceSplitResults<TraceFullDetailed> | null;
  tree: TraceTree;
};

export function TraceDetails(props: TraceDetailsProps) {
  const location = useLocation();
  const organization = useOrganization();
  const issues = useMemo(() => {
    if (!props.node) {
      return [];
    }

    return [...props.node.errors, ...props.node.performance_issues];
  }, [props.node]);

  if (!props.node) {
    return null;
  }

  if (!(props.node && isTraceNode(props.node))) {
    throw new Error('Expected a trace node');
  }

  const {data: rootEvent} = props.rootEventResults;

  return (
    <Fragment>
      {props.tree.type === 'trace' ? <TraceWarnings type={props.traceType} /> : null}
      <IssueList issues={issues} node={props.node} organization={organization} />
      {rootEvent ? (
        <Tags
          tagsQueryResults={props.tagsQueryResults}
          generateUrl={(key: string, value: string) => {
            const url = props.traceEventView.getResultsViewUrlTarget(
              organization.slug,
              false
            );
            url.query = generateQueryWithTag(url.query, {
              key: formatTagKey(key),
              value,
            });
            return url;
          }}
          totalValues={props.tree.eventsCount}
          eventView={props.traceEventView}
          organization={organization}
          location={location}
        />
      ) : null}
    </Fragment>
  );
}
