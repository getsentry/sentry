import {Fragment, useMemo} from 'react';

import type {Tag} from 'sentry/actionCreators/events';
import type {ApiResult} from 'sentry/api';
import type {EventTransaction} from 'sentry/types/event';
import type EventView from 'sentry/utils/discover/eventView';
import type {
  InfiniteData,
  UseApiQueryResult,
  UseInfiniteQueryResult,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {TraceMetaQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import {IssueList} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/issues/issues';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {isTraceNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {
  TraceShape,
  TraceTree,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

import {GeneralInfo} from './generalInfo';
import {TagsSummary} from './tagsSummary';

type TraceDetailsProps = {
  meta: TraceMetaQueryResults;
  node: TraceTreeNode<TraceTree.NodeValue> | null;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  tagsInfiniteQueryResults: UseInfiniteQueryResult<
    InfiniteData<ApiResult<Tag[]>, unknown>,
    Error
  >;
  traceEventView: EventView;
  traceType: TraceShape;
  tree: TraceTree;
};

export function TraceDetails(props: TraceDetailsProps) {
  const location = useLocation();
  const organization = useOrganization();
  const issues = useMemo(() => {
    if (!props.node) {
      return [];
    }

    return [...props.node.errors, ...props.node.occurences];

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.node, props.node?.errors.size, props.node?.occurences.size]);

  if (!props.node) {
    return null;
  }

  if (!(props.node && isTraceNode(props.node))) {
    throw new Error('Expected a trace node');
  }

  return (
    <Fragment>
      <IssueList issues={issues} node={props.node} organization={organization} />
      <TraceDrawerComponents.SectionCardGroup>
        <GeneralInfo
          organization={organization}
          tree={props.tree}
          node={props.node}
          rootEventResults={props.rootEventResults}
          meta={props.meta}
        />
        <TagsSummary
          tagsInfiniteQueryResults={props.tagsInfiniteQueryResults}
          organization={organization}
          location={location}
          eventView={props.traceEventView}
          totalValues={props.tree.transactions_count}
        />
      </TraceDrawerComponents.SectionCardGroup>
    </Fragment>
  );
}
