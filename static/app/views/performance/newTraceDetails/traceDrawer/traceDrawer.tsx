import {useMemo, useRef} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button} from 'sentry/components/button';
import {IconPanel, IconPin} from 'sentry/icons';
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
import {
  getTraceTabTitle,
  type TraceTabsReducerAction,
  type TraceTabsReducerState,
} from 'sentry/views/performance/newTraceDetails/traceTabs';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/virtualizedViewManager';

import {makeTraceNodeBarColor, type TraceTree, type TraceTreeNode} from '../traceTree';

import NodeDetail from './tabs/details';
import {TraceLevelDetails} from './tabs/trace';

const MIN_TRACE_DRAWER_DIMENSTIONS: [number, number] = [480, 30];

type TraceDrawerProps = {
  drawerSize: number;
  layout: 'drawer bottom' | 'drawer left' | 'drawer right';
  location: Location;
  manager: VirtualizedViewManager;
  onDrawerResize: (size: number) => void;
  onLayoutChange: (layout: 'drawer bottom' | 'drawer left' | 'drawer right') => void;
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  scrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  tabs: TraceTabsReducerState;
  tabsDispatch: React.Dispatch<TraceTabsReducerAction>;
  trace: TraceTree;
  traceEventView: EventView;
  traces: TraceSplitResults<TraceFullDetailed> | null;
};

function TraceDrawer(props: TraceDrawerProps) {
  const theme = useTheme();
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
    <PanelWrapper layout={props.layout} ref={panelRef}>
      <ResizeableHandle layout={props.layout} onMouseDown={onMouseDown} />
      <TabsLayout
        hasIndicators={
          // Syncs the height of the tabs with the trace indicators
          props.trace.indicators.length > 0 && props.layout !== 'drawer bottom'
        }
      >
        <TabsContainer
          style={{
            gridTemplateColumns: `repeat(${props.tabs.tabs.length + (props.tabs.last_clicked ? 1 : 0)}, minmax(0, min-content))`,
          }}
        >
          {props.tabs.tabs.map((n, i) => {
            return (
              <TraceDrawerTab
                key={i}
                tab={n}
                index={i}
                theme={theme}
                tabs={props.tabs}
                tabsDispatch={props.tabsDispatch}
                scrollToNode={props.scrollToNode}
                trace={props.trace}
                pinned
              />
            );
          })}
          {props.tabs.last_clicked ? (
            <TraceDrawerTab
              pinned={false}
              key="last-clicked"
              tab={props.tabs.last_clicked}
              index={props.tabs.tabs.length}
              theme={theme}
              tabs={props.tabs}
              tabsDispatch={props.tabsDispatch}
              scrollToNode={props.scrollToNode}
              trace={props.trace}
            />
          ) : null}
        </TabsContainer>
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
      </TabsLayout>
      <Content>
        <ContentWrapper>
          {props.tabs.current ? (
            props.tabs.current.node === 'Trace' ? (
              <TraceLevelDetails
                node={props.trace.root.children[0]}
                tree={props.trace}
                rootEventResults={props.rootEventResults}
                organization={props.organization}
                location={props.location}
                traces={props.traces}
                traceEventView={props.traceEventView}
              />
            ) : (
              <NodeDetail
                node={props.tabs.current.node}
                organization={props.organization}
                location={props.location}
                manager={props.manager}
                scrollToNode={props.scrollToNode}
                onParentClick={node => {
                  props.scrollToNode(node);
                  props.tabsDispatch({
                    type: 'activate tab',
                    payload: node,
                    pin_previous: true,
                  });
                }}
              />
            )
          ) : null}
        </ContentWrapper>
      </Content>
    </PanelWrapper>
  );
}

interface TraceDrawerTabProps {
  index: number;
  pinned: boolean;
  scrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  tab: TraceTabsReducerState['tabs'][number];
  tabs: TraceTabsReducerState;
  tabsDispatch: React.Dispatch<TraceTabsReducerAction>;
  theme: Theme;
  trace: TraceTree;
}
function TraceDrawerTab(props: TraceDrawerTabProps) {
  const node = props.tab.node;
  if (typeof node === 'string') {
    const root = props.trace.root.children[0];
    return (
      <Tab
        active={props.tab === props.tabs.current}
        onClick={() => {
          props.scrollToNode(root);
          props.tabsDispatch({type: 'activate tab', payload: props.index});
        }}
      >
        {/* A trace is technically an entry in the list, so it has a color */}
        {props.tab.node === 'Trace' ? null : (
          <TabButtonIndicator
            backgroundColor={makeTraceNodeBarColor(props.theme, root)}
          />
        )}
        <TabButton>{props.tab.node}</TabButton>
      </Tab>
    );
  }

  return (
    <Tab
      active={props.tab === props.tabs.current}
      onClick={() => {
        props.scrollToNode(node);
        props.tabsDispatch({type: 'activate tab', payload: props.index});
      }}
    >
      <TabButtonIndicator backgroundColor={makeTraceNodeBarColor(props.theme, node)} />
      <TabButton>{getTraceTabTitle(node)}</TabButton>
      <TabPinButton
        pinned={props.pinned}
        onClick={e => {
          e.stopPropagation();
          props.pinned
            ? props.tabsDispatch({type: 'unpin tab', payload: props.index})
            : props.tabsDispatch({type: 'pin tab'});
        }}
      />
    </Tab>
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

const TabsLayout = styled('div')<{hasIndicators: boolean}>`
  display: grid;
  grid-template-columns: 1fr auto;
  border-bottom: 1px solid ${p => p.theme.border};
  background-color: ${p => p.theme.backgroundSecondary};
  height: ${p => (p.hasIndicators ? '44px' : '26px')};
`;

const TabsContainer = styled('ul')`
  display: grid;
  list-style-type: none;
  width: 100%;
  align-items: center;
  justify-content: left;
  padding-left: ${space(1)};
  gap: ${space(1)};
  margin-bottom: 0;
`;

const TabLayoutControlsContainer = styled('ul')`
  list-style-type: none;
  padding-left: 0;
  margin-bottom: 0;

  button {
    padding: 0 ${space(0.5)};
  }
`;

const TabLayoutControlItem = styled('li')`
  display: inline-block;
  margin: 0;
`;

const Tab = styled('li')<{active: boolean}>`
  height: 100%;
  border-top: 2px solid transparent;
  display: flex;
  align-items: center;
  border-bottom: 2px solid ${p => (p.active ? p.theme.blue400 : 'transparent')};
  padding: 0 ${space(0.25)};

  &:hover {
    border-bottom: 2px solid ${p => (p.active ? p.theme.blue400 : p.theme.blue200)};

    button:last-child {
      transition: all 0.3s ease-in-out 500ms;
      transform: scale(1);
      opacity: 1;
    }
  }
`;

const TabButtonIndicator = styled('div')<{backgroundColor: string}>`
  width: 12px;
  height: 12px;
  min-width: 12px;
  border-radius: 2px;
  background-color: ${p => p.backgroundColor};
`;
const TabButton = styled('button')`
  height: 100%;
  border: none;
  max-width: 66ch;

  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  border-radius: 0;
  margin: 0;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.textColor};
  background: transparent;
`;

const Content = styled('div')`
  position: relative;
  overflow: auto;
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

function TabPinButton(props: {
  pinned: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  return (
    <PinButton size="zero" onClick={props.onClick}>
      <StyledIconPin size="xs" isSolid={props.pinned} />
    </PinButton>
  );
}

const PinButton = styled(Button)`
  padding: ${space(0.5)};
  margin: 0;
  background-color: transparent;
  border: none;

  &:hover {
    background-color: transparent;
  }
`;

const StyledIconPin = styled(IconPin)`
  background-color: transparent;
  border: none;
`;

const ContentWrapper = styled('div')`
  inset: ${space(1)};
  position: absolute;
`;

export default TraceDrawer;
