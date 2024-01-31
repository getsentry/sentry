import { useRef, Component, useCallback, useEffect, useMemo, useState } from 'react';
import type { RouteComponentProps } from 'react-router';
import { AutoSizer, List } from 'react-virtualized';
import type { TransactionEvent } from '@sentry/types';
import type { EventTransaction, Organization } from 'sentry/types';

import type { Client } from 'sentry/api';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import { normalizeDateTimeParams } from 'sentry/components/organizations/pageFilters/parse';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import { ALL_ACCESS_PROJECTS } from 'sentry/constants/pageFilters';
import { t } from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import { TraceFullDetailedQuery } from 'sentry/utils/performance/quickTrace/traceFullQuery';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import { decodeScalar } from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import type { RawSpanType } from 'sentry/components/events/interfaces/spans/types';

type Props = RouteComponentProps<{ traceSlug: string }, {}> & {
  api: Client;
  organization: Organization;
};

class TraceSummary extends Component<Props> {
  componentDidMount(): void {
    const { query } = this.props.location;

    if (query.limit) {
      this.setState({ limit: query.limit });
    }
  }

  handleLimitChange = (newLimit: number) => {
    this.setState({ limit: newLimit });
  };

  getDocumentTitle(): string {
    return [t('Trace Details'), t('Performance')].join(' — ');
  }

  getTraceSlug(): string {
    const { traceSlug } = this.props.params;
    return typeof traceSlug === 'string' ? traceSlug.trim() : '';
  }

  getDateSelection() {
    const { location } = this.props;
    const queryParams = normalizeDateTimeParams(location.query, {
      allowAbsolutePageDatetime: true,
    });
    const start = decodeScalar(queryParams.start);
    const end = decodeScalar(queryParams.end);
    const statsPeriod = decodeScalar(queryParams.statsPeriod);
    return { start, end, statsPeriod };
  }

  getTraceEventView() {
    const traceSlug = this.getTraceSlug();
    const { start, end, statsPeriod } = this.getDateSelection();

    return EventView.fromSavedQuery({
      id: undefined,
      name: `Events with Trace ID ${traceSlug}`,
      fields: ['title', 'event.type', 'project', 'timestamp'],
      orderby: '-timestamp',
      query: `trace:${traceSlug}`,
      projects: [ALL_ACCESS_PROJECTS],
      version: 2,
      start,
      end,
      range: statsPeriod,
    });
  }

  render() {
    const { organization } = this.props;

    return (
      <SentryDocumentTitle title={this.getDocumentTitle()} orgSlug={organization.slug}>
        <Layout.Page>
          <NoProjectMessage organization={organization}>
            <TraceFullDetailedQuery
              location={this.props.location}
              orgSlug={this.props.organization.slug}
              traceId={this.getTraceSlug()}
              start={this.getDateSelection().start}
              end={this.getDateSelection().end}
              statsPeriod={this.getDateSelection().statsPeriod}
            >
              {trace => <TraceView trace={trace?.traces} />}
            </TraceFullDetailedQuery>
          </NoProjectMessage>
        </Layout.Page>
      </SentryDocumentTitle>
    );
  }
}

interface TraceViewProps {
  trace: TraceSplitResults<TraceFullDetailed> | null;
}

/**
 * Fetching top level trace - trasactions max(100)
 * we do not have spans for each transaction - fetch those when user clicks on a view
 * - transaction can be expanded
 * - spans can be expanded, we need to track depth
 * - fetch spans needs to generate gap spans
 *
 * - Tree<Transaction|Span|Meta>
 *  - expandable and needs to be able to fetch its child data
 *  - can output a flattened list of nodes to render
 *
 * @DONE:
 * - implement data fetching for spans
 * - tree change commits should be optimize
 * @TODO:
 * - tree commits should have a simple API, splice is non intuitive and error prone
 * - constructing tree should be iterative
 * - implement zoom in/out swaps
 */

type Transaction = TraceFullDetailed
type TreeNodeValue = RawSpanType | TraceFullDetailed | null

class TraceTree {
  root: TraceTreeNode<TreeNodeValue> = TraceTreeNode.Root();

  static Empty() {
    return new TraceTree();
  }

  static FromTrace(transactions: Transaction[]): TraceTree {
    const tree = new TraceTree();

    function visit(parent: TraceTreeNode<TreeNodeValue> | null, value: TraceFullDetailed, depth: number) {
      const node = new TraceTreeNode(value, depth, { project_slug: value.project_slug, event_id: value.event_id });

      if (parent) {
        parent.children.push(node);
      }

      for (const child of value.children) {
        visit(node, child, depth + 1);
      }

      return node;
    }

    for (const transaction of transactions) {
      visit(tree.root, transaction, 0);
    }

    return tree;
  }

  toList(): TraceTreeNode<TreeNodeValue>[] {
    const list: TraceTreeNode<TreeNodeValue>[] = [];

    function visit(node: TraceTreeNode<TreeNodeValue>) {
      list.push(node);

      if (!node.expanded) {
        return;
      }

      for (const child of node.children) {
        visit(child);
      }
    }

    for (const child of this.root.children) {
      visit(child);
    }

    return list;
  }
}

type TraceTreeNodeMetadata = {
  project_slug: string | undefined
  event_id: string | undefined
}

class TraceTreeNode<TreeNodeValue> {
  value: TreeNodeValue;
  depth: number = 0;
  expanded: boolean = false;
  canFetchData: boolean = true;
  metadata: TraceTreeNodeMetadata = {
    project_slug: undefined,
    event_id: undefined
  }
  children: TraceTreeNode<RawSpanType | TraceFullDetailed>[] = [];

  constructor(node: TreeNodeValue, depth: number, metadata: TraceTreeNodeMetadata) {
    this.value = node;
    this.depth = depth;
    this.metadata = metadata;
  }

  static FromEvent(event: TransactionEvent, depth: number, metadata: TraceTreeNodeMetadata) {
    const node = new TraceTreeNode(event, depth, metadata);
    return node;
  }

  // Returns boolean to indicate if node was updated
  expand(expanded: boolean): boolean {
    if (expanded === this.expanded) {
      return false;
    }

    this.expanded = expanded;
    return true;
  }

  getVisibleChildrenCount(): number {
    if (!this.children.length) {
      return 0;
    }

    let count = 0;
    // @TODO see if we can avoid array copy
    const queue = [...this.children];

    while (queue.length > 0) {
      const next = queue.pop()!;

      if (next.expanded) {
        for (let i = 0; i < next.children.length; i++) {
          queue.push(next.children[i]);
        }
      }
      count++;
    }

    return count;
  }

  static updateTreeDepths(node: TraceTreeNode<RawSpanType | TraceFullDetailed>): TraceTreeNode<RawSpanType | TraceFullDetailed> {
    if (!node.children.length) {
      return node;
    }

    function visit(node: TraceTreeNode<RawSpanType | TraceFullDetailed>, depth: number) {
      node.depth = depth;
      for (const child of node.children) {
        visit(child, depth + 1)
      }
    }

    for (const child of node.children) {
      visit(child, node.depth)
    }

    return node;
  }

  getVisibleChildren(): TraceTreeNode<RawSpanType | TraceFullDetailed>[] {
    if (!this.children.length) {
      return [];
    }

    const children: TraceTreeNode<RawSpanType | TraceFullDetailed>[] = [];
    const queue = [...this.children];

    while (queue.length > 0) {
      const next = queue.pop()!;

      if (next.expanded) {
        let i = next.children.length - 1;
        while (i >= 0) {
          queue.push(next.children[i]);
          --i;
        }
      }

      children.push(next);
    }

    return children;
  }

  static Root() {
    return new TraceTreeNode(null, 0, {
      event_id: undefined,
      project_slug: undefined
    });
  }
}

function fetchTransactionEvent(
  api: Client,
  organization: Organization,
  project_slug: string,
  event_id: string
): Promise<EventTransaction> {
  return api.requestPromise(
    `/organizations/${organization.slug}/events/${project_slug}:${event_id}/`
  );
}

function createSpanTree(parent: TraceTreeNode<RawSpanType | TraceFullDetailed>, spans: RawSpanType[]): TraceTreeNode<RawSpanType | TraceFullDetailed> {
  const parentIsSpan = !isTransactionNode(parent);
  const root = new TraceTreeNode(parent.value, 0, parent.metadata);
  const lookuptable: Record<RawSpanType["span_id"], TraceTreeNode<RawSpanType>> = {}

  const childrenLinks = new Map<string, TraceTreeNodeMetadata>();
  for (const child of parent.children) {
    if (typeof child.value.parent_span_id !== 'string') {
      continue
    }
    childrenLinks.set(child.value.parent_span_id, child.metadata)
  }

  for (const span of spans) {
    const node = new TraceTreeNode(span, parent.depth, { event_id: undefined, project_slug: undefined });
    const parentLinkMetadata = childrenLinks.get(span.span_id);
    node.expanded = true;
    node.canFetchData = !!parentLinkMetadata;
    if (parentLinkMetadata) {
      node.metadata = parentLinkMetadata
    }

    lookuptable[span.span_id] = node;

    if (parentIsSpan) {
      console.log("Parent is span")
      root.children.push(node)
      continue
    }

    if (span.parent_span_id) {
      if (span.parent_span_id === root.value.span_id) {
        root.children.push(node)
      }
      const parent = lookuptable[span.parent_span_id];
      if (parent) {
        parent.children.push(node)
      } else {
      }
    }
  }

  return root;
}

function TraceView(props: TraceViewProps) {
  const api = useApi();
  const organization = useOrganization();
  const traceTree = useMemo(() => {
    if (!props.trace) {
      return TraceTree.Empty();
    }
    return TraceTree.FromTrace(props.trace.transactions);
  }, [props.trace]);

  const [_bit, setBit] = useState<number>(0);
  const [list, setList] = useState<any[] | null>(null);

  const promisesRef = useRef<Map<TraceTreeNode<TreeNodeValue>, Promise<any>>>();

  if (!promisesRef.current) {
    promisesRef.current = new Map();
  }

  useEffect(() => {
    setList(traceTree.toList());
  }, [traceTree]);

  const handleFetchChildren = useCallback(
    (node: TraceTreeNode<TraceFullDetailed | RawSpanType>, index: number) => {
      if (promisesRef.current?.has(node)) {
        return;
      }

      if (node.metadata.project_slug === undefined || node.metadata.event_id === undefined) {
        throw new TypeError(`Missing project ${node.metadata.project_slug} or event_id ${node.metadata.event_id}`)
      }

      const promise = fetchTransactionEvent(
        api,
        organization,
        node.metadata.project_slug,
        node.metadata.event_id
      ).then(event => {
        const spans = event.entries.find(s => s.type === "spans");
        console.log(event.entries, spans)
        if (!spans) {
          return
        }

        const childrenCount = node.getVisibleChildrenCount();
        list?.splice(index + 1, childrenCount)

        // @TODO store both states so that we can zoom in/out
        const root = createSpanTree(node, (spans?.data ?? []) as RawSpanType[]);
        node.expanded = true;
        node.children = root.children;
        TraceTreeNode.updateTreeDepths(root)

        const children = node.getVisibleChildren();
        list!.splice(index + 1, 0, ...children);
        setBit(b => (b + 1) % 2);
      }).catch(_e => {
        // Ignore error
      })

      promisesRef.current?.set(node, promise)
    },
    [api, list, organization]
  );

  const handleExpandNode = useCallback(
    (node: TraceTreeNode<TraceFullDetailed | RawSpanType>, value: boolean, index: number) => {
      const prevValue = node.expanded;
      const updated = node.expand(value);

      if (!updated) {
        return;
      }

      if (prevValue === true) {
        const childrenCount = node.getVisibleChildrenCount();
        list!.splice(index + 1, childrenCount);
      } else {
        const children = node.getVisibleChildren();
        list!.splice(index + 1, 0, ...children);
      }

      setBit(b => (b + 1) % 2);
    },
    [list]
  );

  return (
    <AutoSizer>
      {({ width, height }) => (
        <List
          rowHeight={30}
          height={height}
          width={width}
          overscanRowCount={5}
          rowCount={list?.length ?? 0}
          rowRenderer={p => (
            <RenderRow
              index={p.index}
              node={list?.[p.index]}
              style={p.style}
              onFetchChildren={handleFetchChildren}
              onExpandNode={handleExpandNode}
            />
          )}
        />
      )}
    </AutoSizer>
  );
}

function RenderRow(props: {
  index: number;
  node: TraceTreeNode<TraceFullDetailed | RawSpanType>;
  onExpandNode: (
    node: TraceTreeNode<TraceFullDetailed | RawSpanType>,
    value: boolean,
    index: number
  ) => void;
  onFetchChildren: (node: TraceTreeNode<TraceFullDetailed | RawSpanType>, index) => void;
  style: React.CSSProperties;
}) {
  if (!props.node.value) {
    return null;
  }

  if (isTransactionNode(props.node)) {
    return (
      <div style={{ ...props.style, paddingLeft: props.node.depth * 8 }}>
        {props.node.value.transaction}
        {props.node.children.length > 0 && (
          <button
            onClick={() =>
              props.onExpandNode(props.node, !props.node.expanded, props.index)
            }
          >
            {props.node.expanded ? 'Collapse' : 'Expand'}
          </button>
        )}
        {props.node.canFetchData ?
          (<button onClick={() => props.onFetchChildren(props.node, props.index)}>
            zoom in
          </button>) : null}
      </div>
    );
  }

  const name = props.node.value?.description?.slice(0, 40) ?? props.node.value.op ?? "unknown";
  return (
    <div style={{ ...props.style, paddingLeft: props.node.depth * 8 }}>
      {name}
      {props.node.children.length > 0 && (
        <button
          onClick={() =>
            props.onExpandNode(props.node, !props.node.expanded, props.index)
          }
        >
          {props.node.expanded ? 'Collapse' : 'Expand'}
        </button>
      )}
      {props.node.canFetchData ?
        (<button onClick={() => props.onFetchChildren(props.node, props.index)}>
          zoom in
        </button>) : null
      }
    </div>
  );
}

function isTransactionNode(node: TraceTreeNode<TreeNodeValue>): node is TraceTreeNode<TraceFullDetailed> {
  return !!(node.value && "transaction" in node.value);
}

export default withOrganization(withApi(TraceSummary));
