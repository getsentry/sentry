import {useCallback, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {Location} from 'history';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
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
import type {
  TraceTabsReducerAction,
  TraceTabsReducerState,
} from 'sentry/views/performance/newTraceDetails/traceTabs';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/virtualizedViewManager';

import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isSpanNode,
  isTraceErrorNode,
  isTraceNode,
  isTransactionNode,
} from '../guards';
import {makeTraceNodeBarColor, type TraceTree, type TraceTreeNode} from '../traceTree';

import NodeDetail from './tabs/details';
import {TraceLevelDetails} from './tabs/trace';

const MIN_PANEL_HEIGHT = 31;
const DEFAULT_PANEL_HEIGHT = 200;

function getTabTitle(node: TraceTreeNode<TraceTree.NodeValue>) {
  if (isTransactionNode(node)) {
    return (
      node.value['transaction.op'] +
      (node.value.transaction ? ' - ' + node.value.transaction : '')
    );
  }

  if (isSpanNode(node)) {
    return node.value.op + (node.value.description ? ' - ' + node.value.description : '');
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

  if (isTraceNode(node)) {
    return t('Trace');
  }

  Sentry.captureMessage('Unknown node type in trace drawer');
  return 'Unknown';
}

type TraceDrawerProps = {
  location: Location;
  manager: VirtualizedViewManager;
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
      <TabsContainer
        style={{
          gridTemplateColumns: `auto repeat(${props.tabs.tabs.length + 1}, minmax(0, min-content))`,
        }}
      >
        {props.tabs.tabs.map((n, i) => {
          const title = getTabTitle(n.node);
          return (
            <Tab
              key={i}
              active={n.active}
              onClick={() =>
                props.tabsDispatch({type: 'set active tab', payload: n.node})
              }
            >
              {isTraceNode(n.node) ? null : (
                <TabButtonIndicator
                  backgroundColor={makeTraceNodeBarColor(theme, n.node)}
                />
              )}
              <TabButton>{title}</TabButton>
              <DropdownMenu
                position="bottom-end"
                trigger={triggerProps => (
                  <button {...triggerProps}>
                    <IconEllipsis />
                  </button>
                )}
                items={[
                  {
                    key: 'persist',
                    label: t('Persist tab'),
                    onAction: () => {
                      props.tabsDispatch({type: 'clear active tab'});
                    },
                  },
                  {
                    key: 'close',
                    label: t('Close tab'),
                    onAction: () => props.tabsDispatch({type: 'close tab', payload: i}),
                  },
                ]}
              />
            </Tab>
          );
        })}
      </TabsContainer>
      <Content>
        {props.tabs.tabs.map((n, i) => {
          if (!n.active) return null;
          if (isTraceNode(n.node)) {
            return (
              <TraceLevelDetails
                key={i}
                tree={props.trace}
                rootEventResults={props.rootEventResults}
                organization={props.organization}
                location={props.location}
                traces={props.traces}
                traceEventView={props.traceEventView}
              />
            );
          }
          return (
            <NodeDetail
              key={i}
              node={n.node}
              organization={props.organization}
              location={props.location}
              manager={props.manager}
              scrollToNode={props.scrollToNode}
            />
          );
        })}
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
  overflow: hidden;
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
  display: grid;
  width: 100%;
  list-style-type: none;
  min-height: 30px;
  border-bottom: 1px solid ${p => p.theme.border};
  background-color: ${p => p.theme.backgroundSecondary};
  align-items: center;
  justify-content: left;
  padding-left: ${space(1)};
  gap: ${space(1)};
  margin-bottom: 0;
`;

const Tab = styled('li')<{active: boolean}>`
  height: 100%;
  border-top: 2px solid transparent;
  display: flex;
  align-items: center;
  border-bottom: 2px solid ${p => (p.active ? p.theme.blue400 : 'transparent')};
  padding: ${space(0.25)};

  &:hover {
    border-bottom: 2px solid ${p => (p.active ? p.theme.blue400 : p.theme.blue200)};

    button:last-child {
      transition: all 0.3s ease-in-out 500ms;
      transform: scale(1);
      opacity: 1;
    }
  }

  button {
    font-weight: ${p => (p.active ? 'bold' : 'normal')};
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
  overflow: scroll;
  padding: ${space(1)};
  flex: 1;
`;

export default TraceDrawer;
