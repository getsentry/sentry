import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
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

import type {TraceTree, TraceTreeNode} from '../traceTree';

import NodeDetail from './tabs/nodeDetails';
import {TraceLevelDetails} from './tabs/traceLevelDetails';

type DrawerProps = {
  location: Location;
  node: TraceTreeNode<TraceTree.NodeValue> | null;
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  setDetailPanelRef: Dispatch<
    SetStateAction<MutableRefObject<HTMLDivElement | null> | null>
  >;
  traceEventView: EventView;
  traces: TraceSplitResults<TraceFullDetailed> | null;
};

const MIN_PANEL_HEIGHT = 100;
const INITIAL_PANEL_HEIGHT = 200;

function TraceDrawer(props: DrawerProps) {
  const [activeTab, setActiveTab] = useState<'trace_data' | 'node_detail'>(
    props.node ? 'node_detail' : 'trace_data'
  );

  const [size, setSize] = useState(INITIAL_PANEL_HEIGHT);

  const [isResizing, setIsResizing] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleMouseMove = e => {
      if (!isResizing) return;
      const newSize = Math.max(MIN_PANEL_HEIGHT, size + e.movementY * -1);
      setSize(newSize);
    };

    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [size, isResizing]);

  useEffect(() => {
    if (props.node) {
      setActiveTab('node_detail');
    }
  }, [props.node]);

  useEffect(() => {
    props.setDetailPanelRef(panelRef);
  }, [panelRef, props]);

  const handleMouseDown = e => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
  };

  return (
    <PanelWrapper size={size} ref={panelRef}>
      <TabsContainer onMouseDown={handleMouseDown}>
        <Tab
          active={activeTab === 'node_detail'}
          onClick={() => setActiveTab('node_detail')}
        >
          {t('Details')}
        </Tab>
        <Tab
          active={activeTab === 'trace_data'}
          onClick={() => setActiveTab('trace_data')}
        >
          {t('Trace Data')}
        </Tab>
      </TabsContainer>

      <Content>
        {activeTab === 'trace_data' && (
          <TraceLevelDetails
            rootEventResults={props.rootEventResults}
            organization={props.organization}
            location={props.location}
            traces={props.traces}
            traceEventView={props.traceEventView}
          />
        )}
        {activeTab === 'node_detail' && (
          <NodeDetail
            node={props.node}
            organization={props.organization}
            location={props.location}
          />
        )}
      </Content>
    </PanelWrapper>
  );
}

const PanelWrapper = styled('div')<{size: number}>`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: ${p => p.size}px;
  position: sticky;
  border: 1px solid ${p => p.theme.border};
  bottom: 0;
  right: 0;
  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};
  text-align: left;
  z-index: ${p => p.theme.zIndex.sidebar - 1};
`;

const TabsContainer = styled('div')`
  width: 100%;
  min-height: 30px;
  border-bottom: 1px solid ${p => p.theme.border};
  background-color: ${p => p.theme.backgroundSecondary};
  display: flex;
  align-items: center;
  justify-content: left;
  padding-left: ${space(2)};
  gap: ${space(2)};
  cursor: row-resize;
`;

const Tab = styled('div')<{active: boolean}>`
  cursor: pointer;
  font-size: ${p => p.theme.fontSizeSmall};
  ${p => p.active && `font-weight: bold; border-bottom: 2px solid ${p.theme.textColor};`}
`;

const Content = styled('div')`
  overflow: scroll;
  padding: ${space(2)};
  flex: 1;
`;

export default TraceDrawer;
