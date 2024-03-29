import {useCallback, useMemo, useRef, useState} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button} from 'sentry/components/button';
import {IconChevron, IconPanel, IconPin} from 'sentry/icons';
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

const MIN_TRACE_DRAWER_DIMENSTIONS: [number, number] = [480, 27];

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

function getUninitializedDrawerSize(layout: TraceDrawerProps['layout']): number {
  return layout === 'drawer bottom'
    ? // 36 of the screen height
      Math.max(window.innerHeight * 0.36)
    : // Half the screen minus the ~sidebar width
      Math.max(window.innerWidth * 0.5 - 220, MIN_TRACE_DRAWER_DIMENSTIONS[0]);
}

function getDrawerInitialSize(
  layout: TraceDrawerProps['layout'],
  drawerSize: number
): number {
  return drawerSize > 0 ? drawerSize : getUninitializedDrawerSize(layout);
}

function getDrawerMinSize(layout: TraceDrawerProps['layout']): number {
  return layout === 'drawer left' || layout === 'drawer right'
    ? MIN_TRACE_DRAWER_DIMENSTIONS[0]
    : MIN_TRACE_DRAWER_DIMENSTIONS[1];
}

const LAYOUT_STORAGE: Partial<Record<TraceDrawerProps['layout'], number>> = {};

export function TraceDrawer(props: TraceDrawerProps) {
  const theme = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);
  const [minimized, setMinimized] = useState(
    Math.round(props.drawerSize) <= getDrawerMinSize(props.layout)
  );

  const minimizedRef = useRef(minimized);
  minimizedRef.current = minimized;

  const lastNonMinimizedSizeRef =
    useRef<Partial<Record<TraceDrawerProps['layout'], number>>>(LAYOUT_STORAGE);

  const lastLayoutRef = useRef<TraceDrawerProps['layout']>(props.layout);

  const onDrawerResize = props.onDrawerResize;
  const onResize = useCallback(
    (newSize: number, _oldSize: number | undefined, userEvent: boolean) => {
      const min = getDrawerMinSize(props.layout);

      // Round to nearest pixel value
      newSize = Math.round(newSize);

      if (userEvent) {
        lastNonMinimizedSizeRef.current[props.layout] = newSize;

        // Track the value to see if the user manually minimized or expanded the drawer
        if (!minimizedRef.current && newSize <= min) {
          setMinimized(true);
        } else if (minimizedRef.current && newSize > min) {
          setMinimized(false);
        }
      }

      if (minimizedRef.current) {
        newSize = min;
      }

      onDrawerResize(newSize);
      lastLayoutRef.current = props.layout;

      if (!panelRef.current) {
        return;
      }

      if (props.layout === 'drawer left' || props.layout === 'drawer right') {
        panelRef.current.style.width = `${newSize}px`;
        panelRef.current.style.height = `100%`;
      } else {
        panelRef.current.style.height = `${newSize}px`;
        panelRef.current.style.width = `100%`;
      }
      // @TODO This can visual delays as the rest of the view uses a resize observer
      // to adjust the layout. We should force a sync layout update + draw here to fix that.
    },
    [onDrawerResize, props.layout]
  );

  const resizableDrawerOptions: UseResizableDrawerOptions = useMemo(() => {
    return {
      initialSize:
        lastNonMinimizedSizeRef[props.layout] ??
        getDrawerInitialSize(props.layout, props.drawerSize),
      min: getDrawerMinSize(props.layout),
      onResize,
      direction:
        props.layout === 'drawer left'
          ? 'left'
          : props.layout === 'drawer right'
            ? 'right'
            : 'up',
    };
  }, [props.layout, onResize, props.drawerSize]);

  const {onMouseDown, setSize} = useResizableDrawer(resizableDrawerOptions);
  const onMinimize = useCallback(
    (value: boolean) => {
      minimizedRef.current = value;
      setMinimized(value);

      if (!value) {
        const lastUserSize = lastNonMinimizedSizeRef.current[props.layout];
        const min = getDrawerMinSize(props.layout);

        // If the user has minimized the drawer to the minimum size, we should
        // restore the drawer to the initial size instead of the last user size.
        if (lastUserSize === undefined || lastUserSize <= min) {
          setSize(getUninitializedDrawerSize(props.layout), true);
          return;
        }

        setSize(lastUserSize, false);
        return;
      }

      setSize(
        props.layout === 'drawer bottom'
          ? MIN_TRACE_DRAWER_DIMENSTIONS[1]
          : MIN_TRACE_DRAWER_DIMENSTIONS[0],
        false
      );
    },
    [props.layout, setSize]
  );

  const onParentClick = useCallback(
    (node: TraceTreeNode<TraceTree.NodeValue>) => {
      props.scrollToNode(node);
      props.tabsDispatch({
        type: 'activate tab',
        payload: node,
        pin_previous: true,
      });
    },
    [props]
  );

  return (
    <PanelWrapper layout={props.layout} ref={panelRef}>
      <ResizeableHandle layout={props.layout} onMouseDown={onMouseDown} />
      <TabsLayout
        hasIndicators={
          // Syncs the height of the tabs with the trace indicators
          props.trace.indicators.length > 0 && props.layout !== 'drawer bottom'
        }
      >
        <TabActions>
          <TabLayoutControlItem>
            <TabIconButton
              size="xs"
              active={minimized}
              onClick={() => onMinimize(!minimized)}
              aria-label={t('Minimize')}
              icon={
                <SmallerChevronIcon
                  size="sm"
                  isCircled
                  direction={
                    props.layout === 'drawer bottom'
                      ? minimized
                        ? 'up'
                        : 'down'
                      : props.layout === 'drawer left'
                        ? minimized
                          ? 'right'
                          : 'left'
                        : minimized
                          ? 'left'
                          : 'right'
                  }
                />
              }
            />
          </TabLayoutControlItem>
        </TabActions>
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
        <TabActions>
          <TabLayoutControlItem>
            <TabIconButton
              active={props.layout === 'drawer left'}
              onClick={() => props.onLayoutChange('drawer left')}
              size="xs"
              aria-label={t('Drawer left')}
              icon={<IconPanel size="xs" direction="left" />}
            />
          </TabLayoutControlItem>
          <TabLayoutControlItem>
            <TabIconButton
              active={props.layout === 'drawer bottom'}
              onClick={() => props.onLayoutChange('drawer bottom')}
              size="xs"
              aria-label={t('Drawer bottom')}
              icon={<IconPanel size="xs" direction="down" />}
            />
          </TabLayoutControlItem>
          <TabLayoutControlItem>
            <TabIconButton
              active={props.layout === 'drawer right'}
              onClick={() => props.onLayoutChange('drawer right')}
              size="xs"
              aria-label={t('Drawer right')}
              icon={<IconPanel size="xs" direction="right" />}
            />
          </TabLayoutControlItem>
        </TabActions>
      </TabsLayout>
      <Content layout={props.layout}>
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
                onParentClick={onParentClick}
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
        <TabButton>{node}</TabButton>
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

const SmallerChevronIcon = styled(IconChevron)`
  width: 13px;
  height: 13px;

  transition: none;
`;

const TabsLayout = styled('div')<{hasIndicators: boolean}>`
  display: grid;
  grid-template-columns: auto 1fr auto;
  border-bottom: 1px solid ${p => p.theme.border};
  background-color: ${p => p.theme.backgroundSecondary};
  height: ${p => (p.hasIndicators ? '44px' : '26px')};
  padding-left: ${space(0.25)};
  padding-right: ${space(0.5)};
`;

const TabsContainer = styled('ul')`
  display: grid;
  list-style-type: none;
  width: 100%;
  align-items: center;
  justify-content: left;
  gap: ${space(1)};
  padding-left: 0;
  margin-bottom: 0;
`;

const TabActions = styled('ul')`
  list-style-type: none;
  padding-left: 0;
  margin-bottom: 0;
  flex: none;

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

const Content = styled('div')<{layout: 'drawer bottom' | 'drawer left' | 'drawer right'}>`
  position: relative;
  overflow: auto;
  padding: ${space(1)};
  flex: 1;

  td {
    max-width: 100% !important;
  }

  ${p =>
    p.layout !== 'drawer bottom' &&
    `
        table {
          display: flex;
        }

        tbody {
          flex: 1;
        }

        tr {
          display: grid;
        }
      `}
`;

const TabIconButton = styled(Button)<{active: boolean}>`
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
