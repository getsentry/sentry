import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import type {Tag} from 'sentry/actionCreators/events';
import {Button} from 'sentry/components/button';
import {IconChevron, IconCircleFill, IconClose, IconPanel, IconPin} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type EventView from 'sentry/utils/discover/eventView';
import {PERFORMANCE_URL_PARAM} from 'sentry/utils/performance/constants';
import {
  cancelAnimationTimeout,
  requestAnimationTimeout,
} from 'sentry/utils/profiling/hooks/useVirtualizedTree/virtualizedTreeUtils';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import {useInfiniteApiQuery} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {Color} from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {ReplayRecord} from 'sentry/views/replays/types';

import {traceAnalytics} from '../traceAnalytics';
import {getTraceQueryParams} from '../traceApi/useTrace';
import type {TraceMetaQueryResults} from '../traceApi/useTraceMeta';
import {DrawerContainerRefContext} from '../traceDrawer/details/drawerContainerRefContext';
import {TraceProfiles} from '../traceDrawer/tabs/traceProfiles';
import {TraceVitals} from '../traceDrawer/tabs/traceVitals';
import {
  usePassiveResizableDrawer,
  type UsePassiveResizableDrawerOptions,
} from '../traceDrawer/usePassiveResizeableDrawer';
import type {TraceShape, TraceTree} from '../traceModels/traceTree';
import type {TraceTreeNode} from '../traceModels/traceTreeNode';
import type {TraceScheduler} from '../traceRenderers/traceScheduler';
import type {VirtualizedViewManager} from '../traceRenderers/virtualizedViewManager';
import {makeTraceNodeBarColor} from '../traceRow/traceBar';
import type {TraceReducerAction, TraceReducerState} from '../traceState';
import {TRACE_DRAWER_DEFAULT_SIZES} from '../traceState/tracePreferences';
import {useTraceState, useTraceStateDispatch} from '../traceState/traceStateProvider';
import {getTraceTabTitle, type TraceTabsReducerState} from '../traceState/traceTabs';
import {useHasTraceNewUi} from '../useHasTraceNewUi';

import {TraceDetails} from './tabs/trace';
import {TraceTreeNodeDetails} from './tabs/traceTreeNodeDetails';

type TraceDrawerProps = {
  manager: VirtualizedViewManager;
  meta: TraceMetaQueryResults;
  onScrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  onTabScrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  replay: ReplayRecord | null;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  scheduler: TraceScheduler;
  trace: TraceTree;
  traceEventView: EventView;
  traceGridRef: HTMLElement | null;
  traceType: TraceShape;
};

export function TraceDrawer(props: TraceDrawerProps) {
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();
  const traceState = useTraceState();
  const traceDispatch = useTraceStateDispatch();
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const hasNewTraceUi = useHasTraceNewUi();

  // The /events-facets/ endpoint used to fetch tags for the trace tab is slow. Therefore,
  // we try to prefetch the tags as soon as the drawer loads, hoping that the tags will be loaded
  // by the time the user clicks on the trace tab. Also prevents the tags from being refetched.
  const urlParams = useMemo(() => {
    const {timestamp} = getTraceQueryParams(location.query, undefined);
    const params = pick(location.query, [
      ...Object.values(PERFORMANCE_URL_PARAM),
      'cursor',
    ]);

    if (timestamp) {
      params.traceTimestamp = timestamp;
    }
    return params;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tagsInfiniteQueryResults = useInfiniteApiQuery<Tag[]>({
    queryKey: [
      `/organizations/${organization.slug}/events-facets/`,
      {
        query: {
          ...urlParams,
          ...props.traceEventView.getFacetsAPIPayload(location),
          cursor: undefined,
        },
      },
    ],
  });

  const traceStateRef = useRef(traceState);
  traceStateRef.current = traceState;

  const isDrawerMinimized =
    traceStateRef.current.preferences.drawer.minimized ||
    (hasNewTraceUi && !traceStateRef.current.tabs.current_tab?.node);

  const minimizedBottomDrawerSize = hasNewTraceUi ? 0 : 27;

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

      if (traceStateRef.current.preferences.layout === 'drawer bottom' && user) {
        if (size <= min && !minimized && !hasNewTraceUi) {
          traceDispatch({
            type: 'minimize drawer',
            payload: true,
          });
        } else if (size > min && minimized) {
          traceDispatch({
            type: 'minimize drawer',
            payload: false,
          });
        }
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
      hasNewTraceUi,
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
        min: traceState.preferences.layout === 'drawer bottom' ? 27 : 350,
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
    (node: TraceTreeNode<TraceTree.NodeValue>) => {
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
    if (!isDrawerMinimized) {
      onResize(0, 0, true, true);
      size.current = drawerOptions.min;
    } else {
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

  if (
    isDrawerMinimized &&
    (traceState.preferences.layout !== 'drawer bottom' || hasNewTraceUi)
  ) {
    return hasNewTraceUi ? null : (
      <TabsHeightContainer
        absolute
        layout={traceState.preferences.layout}
        hasIndicators={hasIndicators}
      >
        <TabLayoutControlItem>
          <TraceLayoutMinimizeButton onClick={onMinimizeClick} trace_state={traceState} />
        </TabLayoutControlItem>
      </TabsHeightContainer>
    );
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
          {traceState.preferences.drawer.layoutOptions.length > 0 && !hasNewTraceUi ? (
            <TraceLayoutButtons traceDispatch={traceDispatch} trace_state={traceState} />
          ) : null}
        </TabsLayout>
      </TabsHeightContainer>
      {isDrawerMinimized ? null : (
        <DrawerContainerRefContext.Provider value={contentContainerRef}>
          <Content
            ref={contentContainerRef}
            layout={traceState.preferences.layout}
            data-test-id="trace-drawer"
          >
            <ContentWrapper>
              {traceState.tabs.current_tab ? (
                traceState.tabs.current_tab.node === 'trace' ? (
                  <TraceDetails
                    meta={props.meta}
                    traceType={props.traceType}
                    tree={props.trace}
                    node={props.trace.root.children[0]!}
                    rootEventResults={props.rootEventResults}
                    tagsInfiniteQueryResults={tagsInfiniteQueryResults}
                    traceEventView={props.traceEventView}
                  />
                ) : traceState.tabs.current_tab.node === 'vitals' ? (
                  <TraceVitals trace={props.trace} />
                ) : traceState.tabs.current_tab.node === 'profiles' ? (
                  <TraceProfiles
                    tree={props.trace}
                    onScrollToNode={props.onScrollToNode}
                  />
                ) : (
                  <TraceTreeNodeDetails
                    replay={props.replay}
                    manager={props.manager}
                    organization={organization}
                    onParentClick={onParentClick}
                    node={traceState.tabs.current_tab.node}
                    onTabScrollToNode={props.onTabScrollToNode}
                  />
                )
              ) : null}
            </ContentWrapper>
          </Content>
        </DrawerContainerRefContext.Provider>
      )}
    </PanelWrapper>
  );
}

interface TraceDrawerTabProps {
  index: number;
  onTabScrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
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
  const hasNewTraceUi = useHasTraceNewUi();

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
          <TabButtonIndicator
            backgroundColor={makeTraceNodeBarColor(props.theme, root!)}
          />
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
      {hasNewTraceUi ? (
        <StyledIconCircleFilled
          size="xs"
          color={makeTraceNodeBarColor(props.theme, node) as Color}
        />
      ) : (
        <TabButtonIndicator backgroundColor={makeTraceNodeBarColor(props.theme, node)} />
      )}
      <TabButton>{getTraceTabTitle(node)}</TabButton>
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

function TraceLayoutButtons(props: {
  traceDispatch: React.Dispatch<TraceReducerAction>;
  trace_state: TraceReducerState;
}) {
  const organization = useOrganization();

  return (
    <TabActions>
      {props.trace_state.preferences.drawer.layoutOptions.includes('drawer left') ? (
        <TabLayoutControlItem>
          <TabIconButton
            active={props.trace_state.preferences.layout === 'drawer left'}
            onClick={() => {
              traceAnalytics.trackLayoutChange('drawer left', organization);
              props.traceDispatch({type: 'set layout', payload: 'drawer left'});
            }}
            size="xs"
            aria-label={t('Drawer left')}
            icon={<IconPanel size="xs" direction="left" />}
          />
        </TabLayoutControlItem>
      ) : null}
      {props.trace_state.preferences.drawer.layoutOptions.includes('drawer bottom') ? (
        <TabLayoutControlItem>
          <TabIconButton
            active={props.trace_state.preferences.layout === 'drawer bottom'}
            onClick={() => {
              traceAnalytics.trackLayoutChange('drawer bottom', organization);
              props.traceDispatch({type: 'set layout', payload: 'drawer bottom'});
            }}
            size="xs"
            aria-label={t('Drawer bottom')}
            icon={<IconPanel size="xs" direction="down" />}
          />
        </TabLayoutControlItem>
      ) : null}
      {props.trace_state.preferences.drawer.layoutOptions.includes('drawer right') ? (
        <TabLayoutControlItem>
          <TabIconButton
            active={props.trace_state.preferences.layout === 'drawer right'}
            onClick={() => {
              traceAnalytics.trackLayoutChange('drawer right', organization);
              props.traceDispatch({type: 'set layout', payload: 'drawer right'});
            }}
            size="xs"
            aria-label={t('Drawer right')}
            icon={<IconPanel size="xs" direction="right" />}
          />
        </TabLayoutControlItem>
      ) : null}
    </TabActions>
  );
}

function TraceLayoutMinimizeButton(props: {
  onClick: () => void;
  trace_state: TraceReducerState;
}) {
  const hasNewTraceUi = useHasTraceNewUi();

  if (!hasNewTraceUi) {
    return <LegacyTraceLayoutMinimizeButton {...props} />;
  }

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
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  height: 100%;
  border-bottom: 2px solid transparent;
  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

function LegacyTraceLayoutMinimizeButton(props: {
  onClick: () => void;
  trace_state: TraceReducerState;
}) {
  return (
    <TabIconButton
      size="xs"
      active={props.trace_state.preferences.drawer.minimized}
      onClick={props.onClick}
      aria-label={t('Minimize')}
      icon={
        <SmallerChevronIcon
          size="sm"
          isCircled
          direction={
            props.trace_state.preferences.layout === 'drawer bottom'
              ? props.trace_state.preferences.drawer.minimized
                ? 'up'
                : 'down'
              : props.trace_state.preferences.layout === 'drawer left'
                ? props.trace_state.preferences.drawer.minimized
                  ? 'right'
                  : 'left'
                : props.trace_state.preferences.drawer.minimized
                  ? 'left'
                  : 'right'
          }
        />
      }
    />
  );
}

const StyledIconCircleFilled = styled(IconCircleFill)`
  margin-right: ${space(0.25)};
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

const TabsHeightContainer = styled('div')<{
  hasIndicators: boolean;
  layout: 'drawer bottom' | 'drawer left' | 'drawer right';
  absolute?: boolean;
}>`
  background: ${p => p.theme.background};
  left: ${p => (p.layout === 'drawer left' ? '0' : 'initial')};
  right: ${p => (p.layout === 'drawer right' ? '0' : 'initial')};
  position: ${p => (p.absolute ? 'absolute' : 'relative')};
  height: 38px;
  border-bottom: 1px solid ${p => p.theme.border};
  display: flex;
`;

const TabsLayout = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr auto;
  padding-left: ${space(1)};
  padding-right: ${space(0.5)};
`;

const TabsContainer = styled('ul')`
  display: grid;
  list-style-type: none;
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
  background-color: ${p => p.theme.border};
  transform: translateY(3px);
`;

const TabLayoutControlItem = styled('li')`
  display: inline-block;
  margin: 0;
  position: relative;
  z-index: 10;
  background-color: ${p => p.theme.background};
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
      background-color: ${p => p.theme.border};
    }
  }

  &:hover {
    border-bottom: 2px solid ${p => p.theme.blue200};

    button:last-child {
      transition: all 0.3s ease-in-out 500ms;
      transform: scale(1);
      opacity: 1;
    }
  }
  &[aria-selected='true'] {
    border-bottom: 2px solid ${p => p.theme.blue400};
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
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.textColor};
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

const TabIconButton = styled(Button)<{active: boolean}>`
  border: none;
  background-color: transparent;
  box-shadow: none;
  transition: none !important;
  opacity: ${p => (p.active ? 0.7 : 0.5)};
  height: 24px;
  max-height: 24px;

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
    <PinButton
      size="zero"
      data-test-id="trace-drawer-tab-pin-button"
      onClick={props.onClick}
    >
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
