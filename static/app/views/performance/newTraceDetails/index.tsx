import {Component, useCallback, useMemo, useRef, useState} from 'react';
import type {RouteComponentProps} from 'react-router';
import {AutoSizer, List} from 'react-virtualized';
import styled from '@emotion/styled';

import type {Client} from 'sentry/api';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {TraceFullDetailedQuery} from 'sentry/utils/performance/quickTrace/traceFullQuery';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

import {isTransactionNode, TraceTree, type TraceTreeNode} from './traceTree';

type Props = RouteComponentProps<{traceSlug: string}, {}> & {
  api: Client;
  organization: Organization;
};

class TraceSummary extends Component<Props> {
  componentDidMount(): void {
    const {query} = this.props.location;

    if (query.limit) {
      this.setState({limit: query.limit});
    }
  }

  handleLimitChange = (newLimit: number) => {
    this.setState({limit: newLimit});
  };

  getDocumentTitle(): string {
    return [t('Trace Details'), t('Performance')].join(' — ');
  }

  getTraceSlug(): string {
    const {traceSlug} = this.props.params;
    return typeof traceSlug === 'string' ? traceSlug.trim() : '';
  }

  getDateSelection() {
    const {location} = this.props;
    const queryParams = normalizeDateTimeParams(location.query, {
      allowAbsolutePageDatetime: true,
    });
    const start = decodeScalar(queryParams.start);
    const end = decodeScalar(queryParams.end);
    const statsPeriod = decodeScalar(queryParams.statsPeriod);
    return {start, end, statsPeriod};
  }

  getTraceEventView() {
    const traceSlug = this.getTraceSlug();
    const {start, end, statsPeriod} = this.getDateSelection();

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
    const {organization} = this.props;

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

function TraceView(props: TraceViewProps) {
  const api = useApi();
  const organization = useOrganization();
  const traceTree = useMemo(() => {
    if (!props.trace) {
      return TraceTree.Empty();
    }

    return TraceTree.FromTrace(props.trace.transactions);
  }, [props.trace]);

  const [_rerender, setRender] = useState(0);
  const treeRef = useRef<TraceTree>(traceTree);
  treeRef.current = traceTree;

  const handleFetchChildren = useCallback(
    (node: TraceTreeNode<TraceFullDetailed | RawSpanType>, value: boolean) => {
      treeRef.current
        .zoomIn(node, value, {
          api,
          organization,
        })
        .then(() => {
          setRender(a => (a + 1) % 2);
        });
    },
    [api, organization]
  );

  const handleExpandNode = useCallback(
    (node: TraceTreeNode<TraceFullDetailed | RawSpanType>, value: boolean) => {
      treeRef.current.expand(node, value);
      setRender(a => (a + 1) % 2);
    },
    []
  );

  const {projects} = useProjects();

  const projectLookup = useMemo(() => {
    return projects.reduce<Record<Project['slug'], Project>>((acc, project) => {
      acc[project.slug] = project;
      return acc;
    }, {});
  }, [projects]);

  return (
    <Trace
      style={{
        backgroundColor: '#FFF',
        height: '100%',
        width: '100%',
        position: 'absolute',
      }}
    >
      <AutoSizer>
        {({width, height}) => (
          <List
            rowHeight={24}
            height={height}
            width={width}
            overscanRowCount={5}
            rowCount={treeRef.current.list.length ?? 0}
            rowRenderer={p => (
              <RenderRow
                index={p.index}
                projects={projectLookup}
                node={treeRef.current.list?.[p.index]}
                style={p.style}
                onFetchChildren={handleFetchChildren}
                onExpandNode={handleExpandNode}
              />
            )}
          />
        )}
      </AutoSizer>
    </Trace>
  );
}

function RenderRow(props: {
  index: number;
  node: TraceTreeNode<TraceFullDetailed | RawSpanType>;
  onExpandNode: (
    node: TraceTreeNode<TraceFullDetailed | RawSpanType>,
    value: boolean
  ) => void;
  onFetchChildren: (
    node: TraceTreeNode<TraceFullDetailed | RawSpanType>,
    value: boolean
  ) => void;
  projects: Record<Project['slug'], Project>;
  style: React.CSSProperties;
}) {
  if (!props.node.value) {
    return null;
  }

  if (isTransactionNode(props.node)) {
    const transaction = props.node.value as TraceFullDetailed;

    return (
      <div
        className="TraceRow"
        style={{...props.style, paddingLeft: props.node.depth * 23}}
      >
        {props.node.children.length > 0 ? (
          <ChildrenCountButton
            node={props.node}
            onClick={() => props.onExpandNode(props.node, !props.node.expanded)}
          >
            {props.node.children.length}{' '}
          </ChildrenCountButton>
        ) : null}
        <ProjectBadge project={props.projects[transaction.project_slug]} />
        <span className="TraceOperation">{transaction['transaction.op']}</span>
        <strong> — </strong>
        <span>{transaction.transaction}</span>
        {props.node.canFetchData ? (
          <button onClick={() => props.onFetchChildren(props.node, !props.node.zoomedIn)}>
            {props.node.zoomedIn ? 'Zoom Out' : 'Zoom In'}
          </button>
        ) : null}
      </div>
    );
  }

  const span = props.node.value as RawSpanType;

  return (
    <div
      className="TraceRow"
      style={{...props.style, paddingLeft: props.node.depth * 23}}
    >
      {props.node.children.length > 0 ? (
        <ChildrenCountButton
          node={props.node}
          onClick={() => props.onExpandNode(props.node, !props.node.expanded)}
        >
          {props.node.children.length}{' '}
        </ChildrenCountButton>
      ) : null}
      <span className="TraceOperation">{span.description}</span>
      {props.node.canFetchData ? (
        <button onClick={() => props.onFetchChildren(props.node, !props.node.zoomedIn)}>
          {props.node.zoomedIn ? 'Zoom Out' : 'Zoom In'}
        </button>
      ) : null}
    </div>
  );
}

function ProjectBadge(props: {project: Project}) {
  return <ProjectAvatar project={props.project} />;
}

function ChildrenCountButton(props: {
  children: React.ReactNode;
  node: TraceTreeNode<any>;
  onClick: () => void;
}) {
  return (
    <div className="TraceChildrenCountWrapper">
      <button className="TraceChildrenCount" onClick={props.onClick}>
        {props.children}
        <IconChevron
          size="xs"
          direction={props.node.expanded ? 'up' : 'down'}
          style={{marginLeft: 2}}
        />
      </button>
    </div>
  );
}

const Trace = styled('div')`
  .TraceRow {
    display: flex;
    align-items: center;
    font-size: ${p => p.theme.fontSizeSmall}
  }

  .TraceChildrenCount {
    height: 16px;
    white-space: nowrap;
    min-width: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 99px;
    padding: 0px ${space(0.5)};
    transition: all 0.15s ease-in-out;
    background: ${p => p.theme.background};
    border: 2px solid ${p => p.theme.border};
    line-height: 0;
    z-index: 1;
    font-size: 10px;
    box-shadow: ${p => p.theme.dropShadowLight};
    margin-right: ${space(1)};

    svg {
      width: 7px;
    }
  }

  .TraceChildrenCountWrapper {
    display: flex;
    justify-content: flex-end;
    min-width: 40px;
  }

  .TraceOperation {
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: bold;
  }
`;

export default withOrganization(withApi(TraceSummary));
