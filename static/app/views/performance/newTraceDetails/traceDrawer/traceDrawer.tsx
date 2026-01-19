import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconCircleFill, IconClose, IconPin} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type EventView from 'sentry/utils/discover/eventView';
import {
  cancelAnimationTimeout,
  requestAnimationTimeout,
} from 'sentry/utils/profiling/hooks/useVirtualizedTree/virtualizedTreeUtils';
import useOrganization from 'sentry/utils/useOrganization';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import type {TraceMetaQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import {DrawerContainerRefContext} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/drawerContainerRefContext';
import {
  usePassiveResizableDrawer,
  type UsePassiveResizableDrawerOptions,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/usePassiveResizeableDrawer';
import type {
  TraceShape,
  TraceTree,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {TraceScheduler} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceScheduler';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';
import type {
  TraceReducerAction,
  TraceReducerState,
} from 'sentry/views/performance/newTraceDetails/traceState';
import {TRACE_DRAWER_DEFAULT_SIZES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {
  useTraceState,
  useTraceStateDispatch,
} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
import {type TraceTabsReducerState} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';
import type {ReplayRecord} from 'sentry/views/replays/types';

type TraceDrawerProps = {
  manager: VirtualizedViewManager;
  meta: TraceMetaQueryResults;
  onScrollToNode: (node: BaseNode) => void;
  onTabScrollToNode: (node: BaseNode) => void;
  replay: ReplayRecord | null;
  scheduler: TraceScheduler;
  trace: TraceTree;
  traceEventView: EventView;
  traceGridRef: HTMLElement | null;
  traceId: string;
  traceType: TraceShape;
};

export function TraceDrawer(props: TraceDrawerProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const traceState = useTraceState();
  const traceDispatch = useTraceStateDispatch();
  const contentContainerRef = useRef<HTMLDivElement>(null);

  const traceStateRef = useRef(traceState);
  traceStateRef.current = traceState;

  const isDrawerMinimized =
    traceStateRef.current.preferences.drawer.minimized ||
    !traceStateRef.current.tabs.current_tab?.node;

  const minimizedBottomDrawerSize = 0;

  const initialSizeRef = useRef<Record<string, number> | null>(null);
  if (!initialSizeRef.current) {
    initialSizeRef.current = {};
  }

  const resizeEndRef = useRef<{id: number} | null>(null);
  const onResize = useCallback(
    (size: number, min: number, user?: boolean, minimized?: boolean) => {
      if (!props.traceGridRef) {
        return;
      }

      // When we resize the layout in x axis, we need to update the physical space
      // of the virtualized view manager to make sure a redrawing is correctly triggered.
      // If we dont do this, then the virtualized view manager will only trigger a redraw
      // whenver ResizeObserver detects a change. Since resize observers have "debounced"
      // callbacks, relying only on them to redraw the screen causes visual jank.
      if (
        (traceStateRef.current.preferences.layout === 'drawer left' ||
          traceStateRef.current.preferences.layout === 'drawer right') &&
        props.manager.container
      ) {
        const {width, height} = props.manager.container.getBoundingClientRect();
        props.scheduler.dispatch('set container physical space', [0, 0, width, height]);
      }

      minimized = minimized ?? isDrawerMinimized;

      if (
        traceStateRef.current.preferences.layout === 'drawer bottom' &&
        user &&
        size > min &&
        minimized
      ) {
        traceDispatch({
          type: 'minimize drawer',
          payload: false,
        });
      }

      const {width, height} = props.traceGridRef.getBoundingClientRect();

      const drawerWidth = size / width;
      const drawerHeight = size / height;

      if (resizeEndRef.current) {
        cancelAnimationTimeout(resizeEndRef.current);
      }
      resizeEndRef.current = requestAnimationTimeout(() => {
        if (isDrawerMinimized) {
          return;
        }
        const drawer_size =
          traceStateRef.current.preferences.layout === 'drawer bottom'
            ? drawerHeight
            : drawerWidth;

        traceDispatch({
          type: 'set drawer dimension',
          payload: drawer_size,
        });
      }, 1000);

      if (traceStateRef.current.preferences.layout === 'drawer bottom') {
        min = minimized ? minimizedBottomDrawerSize : size;
      } else {
        min = minimized ? 0 : size;
      }

      if (traceStateRef.current.preferences.layout === 'drawer bottom') {
        props.traceGridRef.style.gridTemplateColumns = `1fr`;
        props.traceGridRef.style.gridTemplateRows = `1fr minmax(${min}px, ${drawerHeight * 100}%)`;
      } else if (traceStateRef.current.preferences.layout === 'drawer left') {
        props.traceGridRef.style.gridTemplateColumns = `minmax(${min}px, ${drawerWidth * 100}%) 1fr`;
        props.traceGridRef.style.gridTemplateRows = '1fr auto';
      } else {
        props.traceGridRef.style.gridTemplateColumns = `1fr minmax(${min}px, ${drawerWidth * 100}%)`;
        props.traceGridRef.style.gridTemplateRows = '1fr auto';
      }
    },
    [
      props.traceGridRef,
      props.manager,
      props.scheduler,
      traceDispatch,
      isDrawerMinimized,
      minimizedBottomDrawerSize,
    ]
  );

  const [drawerRef, setDrawerRef] = useState<HTMLDivElement | null>(null);
  const drawerOptions: Pick<UsePassiveResizableDrawerOptions, 'min' | 'initialSize'> =
    useMemo(() => {
      const initialSizeInPercentage =
        traceState.preferences.drawer.sizes[traceState.preferences.layout];

      // We have a stored user preference for the drawer size
      const {width, height} = props.traceGridRef?.getBoundingClientRect() ?? {
        width: 0,
        height: 0,
      };

      const initialSize = isDrawerMinimized
        ? 0
        : traceState.preferences.layout === 'drawer bottom'
          ? height * initialSizeInPercentage
          : width * initialSizeInPercentage;

      return {
        min: traceState.preferences.layout === 'drawer bottom' ? 27 : 400,
        initialSize,
        ref: drawerRef,
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.traceGridRef, traceState.preferences.layout, drawerRef, isDrawerMinimized]);

  const resizableDrawerOptions: UsePassiveResizableDrawerOptions = useMemo(() => {
    return {
      ...drawerOptions,
      onResize,
      direction:
        traceState.preferences.layout === 'drawer left'
          ? 'left'
          : traceState.preferences.layout === 'drawer right'
            ? 'right'
            : 'up',
    };
  }, [onResize, drawerOptions, traceState.preferences.layout]);

  const {onMouseDown, size} = usePassiveResizableDrawer(resizableDrawerOptions);
  const onParentClick = useCallback(
    (node: BaseNode) => {
      props.onTabScrollToNode(node);
      traceDispatch({
        type: 'activate tab',
        payload: node,
        pin_previous: true,
      });
    },
    [props, traceDispatch]
  );

  const onMinimizeClick = useCallback(() => {
    traceAnalytics.trackDrawerMinimize(organization);
    traceDispatch({
      type: 'minimize drawer',
      payload: !isDrawerMinimized,
    });
    if (isDrawerMinimized) {
      if (drawerOptions.initialSize === 0) {
        const userPreference =
          traceStateRef.current.preferences.drawer.sizes[
            traceStateRef.current.preferences.layout
          ];

        const {width, height} = props.traceGridRef?.getBoundingClientRect() ?? {
          width: 0,
          height: 0,
        };
        const containerSize =
          traceStateRef.current.preferences.layout === 'drawer bottom' ? height : width;
        const drawer_size = containerSize * userPreference;
        onResize(drawer_size, drawerOptions.min, true, false);
        size.current = userPreference;
        return;
      }
      onResize(drawerOptions.initialSize, drawerOptions.min, true, false);
      size.current = drawerOptions.initialSize;
    } else {
      onResize(0, 0, true, true);
      size.current = drawerOptions.min;
    }
  }, [
    size,
    onResize,
    traceDispatch,
    props.traceGridRef,
    isDrawerMinimized,
    organization,
    drawerOptions,
  ]);

  const onDoubleClickResetToDefault = useCallback(() => {
    if (!isDrawerMinimized) {
      onMinimizeClick();
      return;
    }

    traceDispatch({type: 'minimize drawer', payload: false});
    const initialSize = TRACE_DRAWER_DEFAULT_SIZES[traceState.preferences.layout];
    const {width, height} = props.traceGridRef?.getBoundingClientRect() ?? {
      width: 0,
      height: 0,
    };

    const containerSize =
      traceState.preferences.layout === 'drawer bottom' ? height : width;
    const drawer_size = containerSize * initialSize;

    onResize(drawer_size, drawerOptions.min, true, false);
    size.current = drawer_size;
  }, [
    size,
    onMinimizeClick,
    onResize,
    drawerOptions.min,
    traceState.preferences.layout,
    props.traceGridRef,
    isDrawerMinimized,
    traceDispatch,
  ]);

  const initializedRef = useRef(false);
  useLayoutEffect(() => {
    if (initializedRef.current) {
      return;
    }
    if (isDrawerMinimized && props.traceGridRef) {
      if (traceStateRef.current.preferences.layout === 'drawer bottom') {
        props.traceGridRef.style.gridTemplateColumns = `1fr`;
        props.traceGridRef.style.gridTemplateRows = `1fr minmax(${minimizedBottomDrawerSize}px, 0%)`;
        size.current = minimizedBottomDrawerSize;
      } else if (traceStateRef.current.preferences.layout === 'drawer left') {
        props.traceGridRef.style.gridTemplateColumns = `minmax(${0}px, 0%) 1fr`;
        props.traceGridRef.style.gridTemplateRows = '1fr auto';
        size.current = 0;
      } else {
        props.traceGridRef.style.gridTemplateColumns = `1fr minmax(${0}px, 0%)`;
        props.traceGridRef.style.gridTemplateRows = '1fr auto';
        size.current = 0;
      }
      initializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.traceGridRef, minimizedBottomDrawerSize]);

  // Syncs the height of the tabs with the trace indicators
  const hasIndicators =
    props.trace.indicators.length > 0 &&
    traceState.preferences.layout !== 'drawer bottom';

  if (isDrawerMinimized) {
    return null;
  }

  return (
    <PanelWrapper ref={setDrawerRef} layout={traceState.preferences.layout}>
      <ResizeableHandle
        layout={traceState.preferences.layout}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClickResetToDefault}
      />
      <TabsHeightContainer
        layout={traceState.preferences.layout}
        onDoubleClick={onDoubleClickResetToDefault}
        hasIndicators={hasIndicators}
      >
        <TabsLayout data-test-id="trace-drawer-tabs">
          <TabActions>
            <TabLayoutControlItem>
              <TraceLayoutMinimizeButton
                onClick={onMinimizeClick}
                trace_state={traceState}
              />
              <TabSeparator />
            </TabLayoutControlItem>
          </TabActions>
          <TabsContainer
            style={{
              gridTemplateColumns: `repeat(${traceState.tabs.tabs.length + (traceState.tabs.last_clicked_tab ? 1 : 0)}, minmax(0, min-content))`,
            }}
          >
            {/* Renders all open tabs */}
            {traceState.tabs.tabs.map((n, i) => {
              return (
                <TraceDrawerTab
                  key={i}
                  tab={n}
                  index={i}
                  theme={theme}
                  trace={props.trace}
                  trace_state={traceState}
                  traceDispatch={traceDispatch}
                  onTabScrollToNode={props.onTabScrollToNode}
                  pinned
                />
              );
            })}
            {/* Renders the last tab the user clicked on - this one is ephemeral and might change */}
            {traceState.tabs.last_clicked_tab ? (
              <TraceDrawerTab
                pinned={false}
                key="last-clicked"
                tab={traceState.tabs.last_clicked_tab}
                index={traceState.tabs.tabs.length}
                theme={theme}
                trace_state={traceState}
                traceDispatch={traceDispatch}
                onTabScrollToNode={props.onTabScrollToNode}
                trace={props.trace}
              />
            ) : null}
          </TabsContainer>
        </TabsLayout>
      </TabsHeightContainer>
      {isDrawerMinimized ? null : (
        <DrawerContainerRefContext value={contentContainerRef}>
          <Content
            ref={contentContainerRef}
            layout={traceState.preferences.layout}
            data-test-id="trace-drawer"
          >
            <ContentWrapper>
              {traceState.tabs.current_tab &&
              typeof traceState.tabs.current_tab.node !== 'string'
                ? traceState.tabs.current_tab.node.renderDetails({
                    manager: props.manager,
                    node: traceState.tabs.current_tab.node,
                    onParentClick,
                    onTabScrollToNode: props.onTabScrollToNode,
                    organization,
                    replay: props.replay,
                    traceId: props.traceId,
                    tree: props.trace,
                  })
                : null}
            </ContentWrapper>
          </Content>
        </DrawerContainerRefContext>
      )}
    </PanelWrapper>
  );
}

interface TraceDrawerTabProps {
  index: number;
  onTabScrollToNode: (node: BaseNode) => void;
  pinned: boolean;
  tab: TraceTabsReducerState['tabs'][number];
  theme: Theme;
  trace: TraceTree;
  traceDispatch: React.Dispatch<TraceReducerAction>;
  trace_state: TraceReducerState;
}
function TraceDrawerTab(props: TraceDrawerTabProps) {
  const organization = useOrganization();
  const node = props.tab.node;

  if (typeof node === 'string') {
    const root = props.trace.root.children[0];
    return (
      <Tab
        data-test-id="trace-drawer-tab"
        className={typeof props.tab.node === 'string' ? 'Static' : ''}
        aria-selected={
          props.tab === props.trace_state.tabs.current_tab ? 'true' : 'false'
        }
        onClick={() => {
          if (props.tab.node !== 'vitals' && props.tab.node !== 'profiles') {
            traceAnalytics.trackTabView(node, organization);
            props.onTabScrollToNode(root!);
          }
          props.traceDispatch({type: 'activate tab', payload: props.index});
        }}
      >
        {/* A trace is technically an entry in the list, so it has a color */}
        {props.tab.node === 'trace' ||
        props.tab.node === 'vitals' ||
        props.tab.node === 'profiles' ? null : (
          <TabButtonIndicator backgroundColor={root!.makeBarColor(props.theme)} />
        )}
        <TabButton>{props.tab.label ?? node}</TabButton>
      </Tab>
    );
  }

  return (
    <Tab
      data-test-id="trace-drawer-tab"
      aria-selected={props.tab === props.trace_state.tabs.current_tab ? 'true' : 'false'}
      onClick={() => {
        traceAnalytics.trackTabView('event', organization);
        props.onTabScrollToNode(node);
        props.traceDispatch({type: 'activate tab', payload: props.index});
      }}
    >
      <StyledIconCircleFilled size="xs" fill={node.makeBarColor(props.theme)} />
      <TabButton>{node.drawerTabsTitle}</TabButton>
      <TabPinButton
        pinned={props.pinned}
        onClick={e => {
          e.stopPropagation();
          traceAnalytics.trackTabPin(organization);
          props.traceDispatch(
            props.pinned ? {type: 'unpin tab', payload: props.index} : {type: 'pin tab'}
          );
        }}
      />
    </Tab>
  );
}

function TraceLayoutMinimizeButton(props: {
  onClick: () => void;
  trace_state: TraceReducerState;
}) {
  return (
    <CloseButton
      priority="link"
      size="xs"
      borderless
      aria-label={t('Close Drawer')}
      icon={<StyledIconClose />}
      onClick={props.onClick}
    >
      {t('Close')}
    </CloseButton>
  );
}

const StyledIconClose = styled(IconClose)`
  width: 10px;
  height: 10px;
`;

const CloseButton = styled(Button)`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
  height: 100%;
  border-bottom: 2px solid transparent;
  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const StyledIconCircleFilled = styled(IconCircleFill)<{fill: string}>`
  margin-right: ${space(0.25)};
  fill: ${p => p.fill};
`;

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
    p.layout === 'drawer bottom' ? `1px solid ${p.theme.tokens.border.primary}` : 'none'};
  border-left: ${p =>
    p.layout === 'drawer right' ? `1px solid ${p.theme.tokens.border.primary}` : 'none'};
  border-right: ${p =>
    p.layout === 'drawer left' ? `1px solid ${p.theme.tokens.border.primary}` : 'none'};
  bottom: 0;
  right: 0;
  position: relative;
  background: ${p => p.theme.tokens.background.primary};
  color: ${p => p.theme.tokens.content.primary};
  text-align: left;
  z-index: 10;
`;

const TabsHeightContainer = styled('div')<{
  hasIndicators: boolean;
  layout: 'drawer bottom' | 'drawer left' | 'drawer right';
  absolute?: boolean;
}>`
  background: ${p => p.theme.tokens.background.primary};
  left: ${p => (p.layout === 'drawer left' ? '0' : 'initial')};
  right: ${p => (p.layout === 'drawer right' ? '0' : 'initial')};
  position: ${p => (p.absolute ? 'absolute' : 'relative')};
  height: 38px;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  display: flex;
`;

const TabsLayout = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr auto;
  padding-left: ${space(1)};
  padding-right: ${space(0.5)};
  width: 100%;
`;

const TabsContainer = styled('ul')`
  display: grid;
  list-style-type: none;
  height: 100%;
  width: 100%;
  align-items: center;
  justify-content: left;
  gap: ${space(0.5)};
  padding-left: 0;
  margin-bottom: 0;
`;

const TabActions = styled('ul')`
  display: flex;
  align-items: center;
  list-style-type: none;
  padding-left: 0;
  margin-bottom: 0;
  flex: none;

  button {
    padding: 0 ${space(0.25)};
  }
`;

const TabSeparator = styled('span')`
  display: inline-block;
  margin-left: ${space(0.5)};
  margin-right: ${space(0.5)};
  height: 16px;
  width: 1px;
  background-color: ${p => p.theme.tokens.border.primary};
  transform: translateY(3px);
`;

const TabLayoutControlItem = styled('li')`
  display: inline-block;
  margin: 0;
  position: relative;
  z-index: 10;
  background-color: ${p => p.theme.tokens.background.primary};
  height: 100%;
`;

const Tab = styled('li')`
  height: 100%;
  border-top: 2px solid transparent;
  display: flex;
  align-items: center;
  border-bottom: 2px solid transparent;
  padding: 0 ${space(0.25)};
  position: relative;

  &.Static + li:not(.Static) {
    margin-left: 10px;

    &:after {
      display: block;
      content: '';
      position: absolute;
      left: -10px;
      top: 50%;
      transform: translateY(-50%);
      height: 16px;
      width: 1px;
      background-color: ${p => p.theme.tokens.border.primary};
    }
  }

  &:hover {
    border-bottom: 2px solid ${p => p.theme.tokens.border.accent.vibrant};

    button:last-child {
      transition: all 0.3s ease-in-out 500ms;
      transform: scale(1);
      opacity: 1;
    }
  }
  &[aria-selected='true'] {
    border-bottom: 2px solid ${p => p.theme.tokens.graphics.accent.vibrant};
  }
`;

const TabButtonIndicator = styled('div')<{backgroundColor: string}>`
  width: 12px;
  height: 12px;
  min-width: 12px;
  border-radius: 2px;
  margin-right: ${space(0.25)};
  background-color: ${p => p.backgroundColor};
`;

const TabButton = styled('button')`
  height: 100%;
  border: none;
  max-width: 28ch;

  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  border-radius: 0;
  margin: 0;
  padding: 0 ${space(0.25)};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.primary};
  background: transparent;
`;

const Content = styled('div')<{layout: 'drawer bottom' | 'drawer left' | 'drawer right'}>`
  position: relative;
  overflow: auto;
  flex: 1;

  td {
    max-width: 100% !important;
  }
`;

function TabPinButton(props: {
  pinned: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  return (
    <StyledButton
      data-test-id="trace-drawer-tab-pin-button"
      size="zero"
      onClick={props.onClick}
      priority="transparent"
      aria-label={props.pinned ? t('Unpin Tab') : t('Pin Tab')}
      icon={<StyledIconPin size="xs" isSolid={props.pinned} />}
    />
  );
}

const StyledButton = styled(Button)`
  border: none;
  box-shadow: none;
`;

const StyledIconPin = styled(IconPin)`
  background-color: transparent;
  border: none;
`;

const ContentWrapper = styled('div')`
  inset: ${space(1)};
  position: absolute;
`;
