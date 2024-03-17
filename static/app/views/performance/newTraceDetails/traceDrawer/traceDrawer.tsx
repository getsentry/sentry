import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button} from 'sentry/components/button';
import {IconPanel} from 'sentry/icons';
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
import {
  useResizableDrawer,
  type UseResizableDrawerOptions,
} from 'sentry/utils/useResizableDrawer';
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

const MIN_TRACE_DRAWER_DIMENSTIONS: [number, number] = [480, 30];

type TraceDrawerProps = {
  activeTab: 'trace' | 'node';
  drawerSize: number;
  layout: 'drawer bottom' | 'drawer left' | 'drawer right';
  location: Location;
  manager: VirtualizedViewManager;
  nodes: TraceTreeNode<TraceTree.NodeValue>[];
  onDrawerResize: (size: number) => void;
  onLayoutChange: (layout: 'drawer bottom' | 'drawer left' | 'drawer right') => void;
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

  const onDrawerResize = props.onDrawerResize;
  const resizableDrawerOptions: UseResizableDrawerOptions = useMemo(() => {
    const isSidebarLayout =
      props.layout === 'drawer left' || props.layout === 'drawer right';

    const initialSize =
      props.drawerSize > 0
        ? props.drawerSize
        : isSidebarLayout
          ? // Half the screen minus the ~sidebar width
            Math.max(window.innerWidth * 0.5 - 220, MIN_TRACE_DRAWER_DIMENSTIONS[0])
          : // 30% of the screen height
            Math.max(window.innerHeight * 0.3);

    const min = isSidebarLayout ? window.innerWidth * 0.2 : 30;

    function onResize(newSize: number) {
      onDrawerResize(newSize);
      if (!panelRef.current) {
        return;
      }

      if (isSidebarLayout) {
        panelRef.current.style.width = `${newSize}px`;
        panelRef.current.style.height = `100%`;
      } else {
        panelRef.current.style.height = `${newSize}px`;
        panelRef.current.style.width = `100%`;
      }
      // @TODO This can visual delays as the rest of the view uses a resize observer
      // to adjust the layout. We should force a sync layout update + draw here to fix that.
    }

    return {
      initialSize,
      onResize,
      direction:
        props.layout === 'drawer left'
          ? 'left'
          : props.layout === 'drawer right'
            ? 'right'
            : 'up',
      min,
    };
  }, [props.layout, onDrawerResize, props.drawerSize]);

  const {onMouseDown} = useResizableDrawer(resizableDrawerOptions);

  return (
    <PanelWrapper ref={panelRef} layout={props.layout}>
      <ResizeableHandle layout={props.layout} onMouseDown={onMouseDown} />
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
        <TabLayoutControlsContainer>
          <TabLayoutControlItem>
            <DrawerButton
              active={props.layout === 'drawer left'}
              onClick={() => props.onLayoutChange('drawer left')}
              size="xs"
              title={t('Drawer left')}
            >
              <IconPanel size="xs" direction="left" />
            </DrawerButton>
          </TabLayoutControlItem>
          <TabLayoutControlItem>
            <DrawerButton
              active={props.layout === 'drawer bottom'}
              onClick={() => props.onLayoutChange('drawer bottom')}
              size="xs"
              title={t('Drawer bottom')}
            >
              <IconPanel size="xs" direction="down" />
            </DrawerButton>
          </TabLayoutControlItem>
          <TabLayoutControlItem>
            <DrawerButton
              active={props.layout === 'drawer right'}
              onClick={() => props.onLayoutChange('drawer right')}
              size="xs"
              title={t('Drawer right')}
            >
              <IconPanel size="xs" direction="right" />
            </DrawerButton>
          </TabLayoutControlItem>
        </TabLayoutControlsContainer>
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

const ResizeableHandle = styled('div')<{
  layout: 'drawer bottom' | 'drawer left' | 'drawer right';
}>`
  width: ${p => (p.layout === 'drawer bottom' ? '100%' : '12px')};
  height: ${p => (p.layout === 'drawer bottom' ? '12px' : '100%')};
  cursor: ${p => (p.layout === 'drawer bottom' ? 'ns-resize' : 'ew-resize')};
  position: absolute;
  top: ${p => (p.layout === 'drawer bottom' ? '-6px' : 0)};
  left: ${p =>
    p.layout === 'drawer bottom' ? 0 : p.layout === 'drawer right' ? '-6px' : 'initial'};
  right: ${p => (p.layout === 'drawer left' ? '-6px' : 0)};

  z-index: 1;
`;

const PanelWrapper = styled('div')<{
  layout: 'drawer bottom' | 'drawer left' | 'drawer right';
}>`
  grid-area: drawer;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  border-top: ${p =>
    p.layout === 'drawer bottom' ? `1px solid ${p.theme.border}` : 'none'};
  border-left: ${p =>
    p.layout === 'drawer right' ? `1px solid ${p.theme.border}` : 'none'};
  border-right: ${p =>
    p.layout === 'drawer left' ? `1px solid ${p.theme.border}` : 'none'};
  bottom: 0;
  right: 0;
  position: relative;
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

const TabLayoutControlsContainer = styled('ul')`
  list-style-type: none;
  padding-left: 0;

  button {
    padding: ${space(0.5)};
  }
`;

const TabLayoutControlItem = styled('li')`
  display: inline-block;
  margin: 0;
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

const DrawerButton = styled(Button)<{active: boolean}>`
  border: none;
  background-color: transparent;
  box-shadow: none;
  transition: none !important;
  opacity: ${p => (p.active ? 0.7 : 0.5)};

  &:not(:last-child) {
    margin-right: ${space(1)};
  }

  &:hover {
    border: none;
    background-color: transparent;
    box-shadow: none;
    opacity: ${p => (p.active ? 0.6 : 0.5)};
  }
`;

export default TraceDrawer;
