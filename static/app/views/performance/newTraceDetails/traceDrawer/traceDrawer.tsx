import {useCallback, useMemo, useRef} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import type {Tag} from 'sentry/actionCreators/events';
import {Button} from 'sentry/components/button';
import {IconChevron, IconPanel, IconPin} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types';
import type EventView from 'sentry/utils/discover/eventView';
import {PERFORMANCE_URL_PARAM} from 'sentry/utils/performance/constants';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  useResizableDrawer,
  type UseResizableDrawerOptions,
} from 'sentry/utils/useResizableDrawer';
import {TraceVitals} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceVitals';
import type {
  TraceReducerAction,
  TraceReducerState,
} from 'sentry/views/performance/newTraceDetails/traceState';
import {
  getTraceTabTitle,
  type TraceTabsReducerState,
} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/virtualizedViewManager';

import {makeTraceNodeBarColor, type TraceTree, type TraceTreeNode} from '../traceTree';

import {TraceDetails} from './tabs/trace';
import {TraceTreeNodeDetails} from './tabs/traceTreeNodeDetails';

type TraceDrawerProps = {
  manager: VirtualizedViewManager;
  onScrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  trace: TraceTree;
  traceEventView: EventView;
  trace_dispatch: React.Dispatch<TraceReducerAction>;
  trace_state: TraceReducerState;
  traces: TraceSplitResults<TraceFullDetailed> | null;
};

export function TraceDrawer(props: TraceDrawerProps) {
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();
  const panelRef = useRef<HTMLDivElement | null>(null);

  // The /events-facets/ endpoint used to fetch tags for the trace tab is slow. Therefore,
  // we try to prefetch the tags as soon as the drawer loads, hoping that the tags will be loaded
  // by the time the user clicks on the trace tab. Also prevents the tags from being refetched.
  const urlParams = useMemo(() => {
    return pick(location.query, [...Object.values(PERFORMANCE_URL_PARAM), 'cursor']);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const tagsQueryResults = useApiQuery<Tag[]>(
    [
      `/organizations/${organization.slug}/events-facets/`,
      {
        query: {
          ...urlParams,
          ...props.traceEventView.getFacetsAPIPayload(location),
          cursor: undefined,
        },
      },
    ],
    {
      staleTime: Infinity,
    }
  );

  const onResize = useCallback((_newSize: number, _oldSize: number | undefined) => {
    if (panelRef.current) panelRef.current.style.height = `${_newSize}px`;
  }, []);

  const resizableDrawerOptions: UseResizableDrawerOptions = useMemo(() => {
    return {
      initialSize: 200,
      min: 200,
      onResize,
      direction:
        props.trace_state.preferences.layout === 'drawer left'
          ? 'left'
          : props.trace_state.preferences.layout === 'drawer right'
            ? 'right'
            : 'up',
    };
  }, [props.trace_state.preferences.layout, onResize]);

  const {onMouseDown, size: _size} = useResizableDrawer(resizableDrawerOptions);
  const onParentClick = useCallback(
    (node: TraceTreeNode<TraceTree.NodeValue>) => {
      props.onScrollToNode(node);
      props.trace_dispatch({
        type: 'activate tab',
        payload: node,
        pin_previous: true,
      });
    },
    [props]
  );

  // Syncs the height of the tabs with the trace indicators
  const hasIndicators =
    props.trace.indicators.length > 0 &&
    props.trace_state.preferences.layout !== 'drawer bottom';

  if (
    props.trace_state.preferences.drawer.minimized &&
    (props.trace_state.preferences.layout === 'drawer left' ||
      props.trace_state.preferences.layout === 'drawer right')
  ) {
    return (
      <TabsHeightContainer absolute hasIndicators={hasIndicators}>
        <TabLayoutControlItem>
          <TraceLayoutMinimizeButton
            trace_dispatch={props.trace_dispatch}
            trace_state={props.trace_state}
          />
        </TabLayoutControlItem>
      </TabsHeightContainer>
    );
  }

  return (
    <PanelWrapper
      layout={props.trace_state.preferences.layout}
      ref={r => {
        panelRef.current = r;
      }}
    >
      <ResizeableHandle
        layout={props.trace_state.preferences.layout}
        onMouseDown={onMouseDown}
      />
      <TabsHeightContainer hasIndicators={hasIndicators}>
        <TabsLayout>
          <TabActions>
            <TabLayoutControlItem>
              <TraceLayoutMinimizeButton
                trace_dispatch={props.trace_dispatch}
                trace_state={props.trace_state}
              />
            </TabLayoutControlItem>
          </TabActions>
          <TabsContainer
            style={{
              gridTemplateColumns: `repeat(${props.trace_state.tabs.tabs.length + (props.trace_state.tabs.last_clicked_tab ? 1 : 0)}, minmax(0, min-content))`,
            }}
          >
            {/* Renders all open tabs */}
            {props.trace_state.tabs.tabs.map((n, i) => {
              return (
                <TraceDrawerTab
                  key={i}
                  tab={n}
                  index={i}
                  theme={theme}
                  trace_state={props.trace_state}
                  trace_dispatch={props.trace_dispatch}
                  onScrollToNode={props.onScrollToNode}
                  trace={props.trace}
                  pinned
                />
              );
            })}
            {/* Renders the last tab the user clicked on - this one is ephemeral and might change */}
            {props.trace_state.tabs.last_clicked_tab ? (
              <TraceDrawerTab
                pinned={false}
                key="last-clicked"
                tab={props.trace_state.tabs.last_clicked_tab}
                index={props.trace_state.tabs.tabs.length}
                theme={theme}
                trace_state={props.trace_state}
                trace_dispatch={props.trace_dispatch}
                onScrollToNode={props.onScrollToNode}
                trace={props.trace}
              />
            ) : null}
          </TabsContainer>
          <TraceLayoutButtons
            trace_dispatch={props.trace_dispatch}
            trace_state={props.trace_state}
          />
        </TabsLayout>
      </TabsHeightContainer>
      <Content layout={props.trace_state.preferences.layout}>
        <ContentWrapper>
          {props.trace_state.tabs.current_tab ? (
            props.trace_state.tabs.current_tab.node === 'trace' ? (
              <TraceDetails
                tagsQueryResults={tagsQueryResults}
                tree={props.trace}
                node={props.trace.root.children[0]}
                rootEventResults={props.rootEventResults}
                traces={props.traces}
                traceEventView={props.traceEventView}
              />
            ) : props.trace_state.tabs.current_tab.node === 'vitals' ? (
              <TraceVitals trace={props.trace} />
            ) : (
              <TraceTreeNodeDetails
                organization={organization}
                node={props.trace_state.tabs.current_tab.node}
                manager={props.manager}
                scrollToNode={props.onScrollToNode}
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
  onScrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  pinned: boolean;
  tab: TraceTabsReducerState['tabs'][number];
  theme: Theme;
  trace: TraceTree;
  trace_dispatch: React.Dispatch<TraceReducerAction>;
  trace_state: TraceReducerState;
}
function TraceDrawerTab(props: TraceDrawerTabProps) {
  const node = props.tab.node;
  if (typeof node === 'string') {
    const root = props.trace.root.children[0];
    return (
      <Tab
        className={typeof props.tab.node === 'string' ? 'Static' : ''}
        active={props.tab === props.trace_state.tabs.current_tab}
        onClick={() => {
          if (props.tab.node !== 'vitals') {
            props.onScrollToNode(root);
          }
          props.trace_dispatch({type: 'activate tab', payload: props.index});
        }}
      >
        {/* A trace is technically an entry in the list, so it has a color */}
        {props.tab.node === 'trace' || props.tab.node === 'vitals' ? null : (
          <TabButtonIndicator
            backgroundColor={makeTraceNodeBarColor(props.theme, root)}
          />
        )}
        <TabButton>{props.tab.label ?? node}</TabButton>
      </Tab>
    );
  }

  return (
    <Tab
      active={props.tab === props.trace_state.tabs.current_tab}
      onClick={() => {
        props.onScrollToNode(node);
        props.trace_dispatch({type: 'activate tab', payload: props.index});
      }}
    >
      <TabButtonIndicator backgroundColor={makeTraceNodeBarColor(props.theme, node)} />
      <TabButton>{getTraceTabTitle(node)}</TabButton>
      <TabPinButton
        pinned={props.pinned}
        onClick={e => {
          e.stopPropagation();
          props.pinned
            ? props.trace_dispatch({type: 'unpin tab', payload: props.index})
            : props.trace_dispatch({type: 'pin tab'});
        }}
      />
    </Tab>
  );
}

function TraceLayoutButtons(props: {
  trace_dispatch: React.Dispatch<TraceReducerAction>;
  trace_state: TraceReducerState;
}) {
  return (
    <TabActions>
      <TabLayoutControlItem>
        <TabIconButton
          active={props.trace_state.preferences.layout === 'drawer left'}
          onClick={() =>
            props.trace_dispatch({type: 'set layout', payload: 'drawer left'})
          }
          size="xs"
          aria-label={t('Drawer left')}
          icon={<IconPanel size="xs" direction="left" />}
        />
      </TabLayoutControlItem>
      <TabLayoutControlItem>
        <TabIconButton
          active={props.trace_state.preferences.layout === 'drawer bottom'}
          onClick={() =>
            props.trace_dispatch({type: 'set layout', payload: 'drawer bottom'})
          }
          size="xs"
          aria-label={t('Drawer bottom')}
          icon={<IconPanel size="xs" direction="down" />}
        />
      </TabLayoutControlItem>
      <TabLayoutControlItem>
        <TabIconButton
          active={props.trace_state.preferences.layout === 'drawer right'}
          onClick={() =>
            props.trace_dispatch({type: 'set layout', payload: 'drawer right'})
          }
          size="xs"
          aria-label={t('Drawer right')}
          icon={<IconPanel size="xs" direction="right" />}
        />
      </TabLayoutControlItem>
    </TabActions>
  );
}

function TraceLayoutMinimizeButton(props: {
  trace_dispatch: React.Dispatch<TraceReducerAction>;
  trace_state: TraceReducerState;
}) {
  const minimized = props.trace_state.preferences.drawer.minimized;
  const trace_dispatch = props.trace_dispatch;

  const onMinimizeToggle = useCallback(() => {
    trace_dispatch({
      type: 'minimize drawer',
      payload: !minimized,
    });
  }, [trace_dispatch, minimized]);

  return (
    <TabIconButton
      size="xs"
      active={minimized}
      onClick={onMinimizeToggle}
      aria-label={t('Minimize')}
      icon={
        <SmallerChevronIcon
          size="sm"
          isCircled
          direction={
            props.trace_state.preferences.layout === 'drawer bottom'
              ? minimized
                ? 'up'
                : 'down'
              : props.trace_state.preferences.layout === 'drawer left'
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

const TabsHeightContainer = styled('div')<{hasIndicators: boolean; absolute?: boolean}>`
  position: ${p => (p.absolute ? 'absolute' : 'relative')};
  height: ${p => (p.hasIndicators ? '44px' : '26px')};
  border-bottom: 1px solid ${p => p.theme.border};
  background-color: ${p => p.theme.backgroundSecondary};
  display: flex;
  flex-direction: column;
  justify-content: end;
`;

const TabsLayout = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr auto;
  padding-left: ${space(0.25)};
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
  position: relative;

  &.Static + li:not(.Static) {
    margin-left: ${space(2)};

    &:after {
      display: block;
      content: '';
      position: absolute;
      left: -14px;
      top: 50%;
      transform: translateY(-50%);
      height: 72%;
      width: 1px;
      background-color: ${p => p.theme.border};
    }
  }

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
  margin-right: ${space(0.25)};
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
  padding: 0 ${space(0.25)};
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
