import {Fragment, useMemo} from 'react';

import type {Tag} from 'sentry/actionCreators/events';
import type {EventTransaction, Organization} from 'sentry/types';
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
import Tags from 'sentry/views/discover/tags';

import {isTraceNode} from '../../guards';
import type {TraceTree, TraceTreeNode} from '../../traceTree';
import {IssueList} from '../details/issues/issues';

type TraceDetailsProps = {
  node: TraceTreeNode<TraceTree.NodeValue> | null;
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  tagsQueryResults: UseApiQueryResult<Tag[], RequestError>;
  traceEventView: EventView;
  traces: TraceSplitResults<TraceFullDetailed> | null;
  tree: TraceTree;
};

export function TraceDetails(props: TraceDetailsProps) {
  const location = useLocation();
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
      <IssueList issues={issues} node={props.node} organization={props.organization} />
      {rootEvent ? (
        <Tags
          tagsQueryResults={props.tagsQueryResults}
          generateUrl={(key: string, value: string) => {
            const url = props.traceEventView.getResultsViewUrlTarget(
              props.organization.slug,
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
          organization={props.organization}
          location={location}
        />
      ) : null}
    </Fragment>
  );
}
