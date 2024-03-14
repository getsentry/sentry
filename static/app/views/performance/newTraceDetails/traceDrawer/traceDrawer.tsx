import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction, Organization} from 'sentry/types';
import type EventView from 'sentry/utils/discover/eventView';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/virtualizedViewManager';

import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from '../guards';
import type {TraceTree, TraceTreeNode} from '../traceTree';

import NodeDetail from './tabs/details';
import {TraceLevelDetails} from './tabs/trace';

const MIN_PANEL_HEIGHT = 31;
const DEFAULT_PANEL_HEIGHT = 200;

function getTabTitle(node: TraceTreeNode<TraceTree.NodeValue>) {
  if (isTransactionNode(node)) {
    return (
      t('Transaction: ') +
      node.value['transaction.op'] +
      (node.value.transaction ? ' - ' + node.value.transaction : '')
    );
  }

  if (isSpanNode(node)) {
    return (
      t('Span: ') +
      node.value.op +
      (node.value.description ? ' - ' + node.value.description : '')
    );
  }

  if (isAutogroupedNode(node)) {
    return t('Autogroup');
  }

  if (isMissingInstrumentationNode(node)) {
    return t('Missing Instrumentation');
  }

  if (isTraceErrorNode(node)) {
    return node.value.title || 'Error';
  }

  return t('Detail');
}

type TraceDrawerProps = {
  activeTab: 'trace' | 'node';
  location: Location;
  manager: VirtualizedViewManager;
  nodes: TraceTreeNode<TraceTree.NodeValue>[];
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  scrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  setActiveTab: (tab: 'trace' | 'node') => void;
  trace: TraceTree;
  traceEventView: EventView;
  traces: TraceSplitResults<TraceFullDetailed> | null;
};

function TraceDrawer(props: TraceDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onResize = useCallback((newSize: number, maybeOldSize: number | undefined) => {
    if (!panelRef.current) {
      return;
    }

    panelRef.current.style.height = `${maybeOldSize ?? newSize}px`;
    panelRef.current.style.width = `100%`;
  }, []);

  const {onMouseDown} = useResizableDrawer({
    direction: 'up',
    initialSize: DEFAULT_PANEL_HEIGHT,
    min: MIN_PANEL_HEIGHT,
    sizeStorageKey: 'trace-drawer',
    onResize,
  });

  return (
    <PanelWrapper ref={panelRef}>
      <ResizeableHandle onMouseDown={onMouseDown} />
      <TabsContainer>
        <Tab
          active={props.activeTab === 'trace'}
          onClick={() => props.setActiveTab('trace')}
        >
          <TabButton>{t('Trace')}</TabButton>
        </Tab>
        {props.nodes.map((node, index) => {
          const title = getTabTitle(node);
          return (
            <Tab
              key={index}
              active={props.activeTab === 'node'}
              onClick={() => props.setActiveTab('node')}
            >
              <TabButton title={title}>{title}</TabButton>
            </Tab>
          );
        })}
      </TabsContainer>
      <Content>
        {props.activeTab === 'trace' ? (
          <TraceLevelDetails
            tree={props.trace}
            rootEventResults={props.rootEventResults}
            organization={props.organization}
            location={props.location}
            traces={props.traces}
            traceEventView={props.traceEventView}
          />
        ) : (
          props.nodes.map((node, index) => (
            <NodeDetail
              key={index}
              node={node}
              organization={props.organization}
              location={props.location}
              manager={props.manager}
              scrollToNode={props.scrollToNode}
            />
          ))
        )}
      </Content>
    </PanelWrapper>
  );
}

const ResizeableHandle = styled('div')`
  width: 100%;
  height: 12px;
  cursor: ns-resize;
  position: absolute;
  top: -6px;
  left: 0;
  z-index: 1;
`;

const PanelWrapper = styled('div')`
  grid-area: drawer;
  display: flex;
  flex-direction: column;
  width: 100%;
  position: sticky;
  border-top: 1px solid ${p => p.theme.border};
  bottom: 0;
  right: 0;
  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};
  text-align: left;
  z-index: 10;
`;

const TabsContainer = styled('ul')`
  list-style-type: none;
  width: 100%;
  min-height: 30px;
  border-bottom: 1px solid ${p => p.theme.border};
  background-color: ${p => p.theme.backgroundSecondary};
  display: flex;
  align-items: center;
  justify-content: left;
  padding-left: ${space(2)};
  gap: ${space(1)};
  margin-bottom: 0;
`;

const Tab = styled('li')<{active: boolean}>`
  height: 100%;

  button {
    border-bottom: 2px solid ${p => (p.active ? p.theme.blue400 : 'transparent')};
    font-weight: ${p => (p.active ? 'bold' : 'normal')};
  }
`;

const TabButton = styled('button')`
  height: 100%;
  border: none;
  max-width: 260px;

  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  border-top: 2px solid transparent;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  margin: 0;
  padding: ${space(0.25)};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.textColor};
  background: transparent;
`;

const Content = styled('div')`
  overflow: scroll;
  padding: ${space(1)};
  flex: 1;
`;

export default TraceDrawer;
