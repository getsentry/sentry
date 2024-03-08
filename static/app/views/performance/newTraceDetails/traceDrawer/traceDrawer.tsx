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

type DrawerProps = {
  activeTab: 'trace' | 'node';
  location: Location;
  nodes: TraceTreeNode<TraceTree.NodeValue>[];
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  setActiveTab: (tab: 'trace' | 'node') => void;
  traceEventView: EventView;
  traces: TraceSplitResults<TraceFullDetailed> | null;
};

const MIN_PANEL_HEIGHT = 31;
const DEFAULT_PANEL_HEIGHT = 200;

function getTabTitle(node: TraceTreeNode<TraceTree.NodeValue>) {
  if (isTransactionNode(node)) {
    return node.value['transaction.op'] + ' - ' + node.value.transaction;
  }

  if (isSpanNode(node)) {
    return node.value.op + ' - ' + node.value.description;
  }

  if (isAutogroupedNode(node)) {
    return t('Auto-Group');
  }

  if (isMissingInstrumentationNode(node)) {
    return t('Missing Instrumentation Span');
  }

  if (isTraceErrorNode(node)) {
    return node.value.title;
  }

  return t('Detail');
}

function TraceDrawer(props: DrawerProps) {
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
        <Tab
          active={props.activeTab === 'trace'}
          onClick={() => props.setActiveTab('trace')}
        >
          <TabButton>{t('Trace')}</TabButton>
        </Tab>
      </TabsContainer>

      <Content>
        {props.activeTab === 'trace' ? (
          <TraceLevelDetails
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
            />
          ))
        )}
      </Content>
    </PanelWrapper>
  );
}

const ResizeableHandle = styled('div')`
  width: 100%;
  height: 8px;
  cursor: ns-resize;
  position: absolute;
  top: -4px;
  left: 0;
  z-index: 1;
`;

const PanelWrapper = styled('div')`
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
  z-index: ${p => p.theme.zIndex.sidebar - 1};
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
  max-width: 160px;

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
