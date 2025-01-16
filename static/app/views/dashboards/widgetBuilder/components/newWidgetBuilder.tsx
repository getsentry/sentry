import {type CSSProperties, Fragment, useCallback, useEffect, useState} from 'react';
import {closestCorners, DndContext, useDraggable, useDroppable} from '@dnd-kit/core';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';
import cloneDeep from 'lodash/cloneDeep';

import {t} from 'sentry/locale';
import PreferencesStore from 'sentry/stores/preferencesStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {CustomMeasurementsProvider} from 'sentry/utils/customMeasurements/customMeasurementsProvider';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {decodeBoolean} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useKeyPress from 'sentry/utils/useKeyPress';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  type DashboardDetails,
  type DashboardFilters,
  DisplayType,
  type Widget,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {
  DEFAULT_WIDGET_DRAG_POSITIONING,
  DRAGGABLE_PREVIEW_HEIGHT_PX,
  DRAGGABLE_PREVIEW_WIDTH_PX,
  PREVIEW_HEIGHT_PX,
  SIDEBAR_HEIGHT,
  snapPreviewToCorners,
  WIDGET_PREVIEW_DRAG_ID,
  type WidgetDragPositioning,
} from 'sentry/views/dashboards/widgetBuilder/components/common/draggableUtils';
import WidgetBuilderSlideout from 'sentry/views/dashboards/widgetBuilder/components/widgetBuilderSlideout';
import WidgetPreview from 'sentry/views/dashboards/widgetBuilder/components/widgetPreview';
import {
  useWidgetBuilderContext,
  WidgetBuilderProvider,
} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {DashboardsMEPProvider} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';
import {MetricsDataSwitcher} from 'sentry/views/performance/landing/metricsDataSwitcher';

export interface ThresholdMetaState {
  dataType?: string;
  dataUnit?: string;
}

type WidgetBuilderV2Props = {
  dashboard: DashboardDetails;
  dashboardFilters: DashboardFilters;
  isOpen: boolean;
  onClose: () => void;
  onSave: ({index, widget}: {index: number; widget: Widget}) => void;
  openWidgetTemplates: boolean;
  setOpenWidgetTemplates: (openWidgetTemplates: boolean) => void;
};

function WidgetBuilderV2({
  isOpen,
  onClose,
  onSave,
  dashboardFilters,
  dashboard,
  setOpenWidgetTemplates,
  openWidgetTemplates,
}: WidgetBuilderV2Props) {
  const escapeKeyPressed = useKeyPress('Escape');
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const [queryConditionsValid, setQueryConditionsValid] = useState<boolean>(true);
  const theme = useTheme();
  const [isPreviewDraggable, setIsPreviewDraggable] = useState(false);
  const [thresholdMetaState, setThresholdMetaState] = useState<ThresholdMetaState>({});

  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.small})`);

  const [translate, setTranslate] = useState<WidgetDragPositioning>(
    DEFAULT_WIDGET_DRAG_POSITIONING
  );

  // do we want to keep this?
  useEffect(() => {
    if (escapeKeyPressed) {
      if (isOpen) {
        onClose?.();
      }
    }
  }, [escapeKeyPressed, isOpen, onClose]);

  const handleDragEnd = ({over}) => {
    setTranslate(snapPreviewToCorners(over));
  };

  const handleDragMove = ({delta}) => {
    setTranslate(previousTranslate => ({
      ...previousTranslate,
      initialTranslate: previousTranslate.initialTranslate,
      translate: {
        x: previousTranslate.initialTranslate.x + delta.x,
        y: previousTranslate.initialTranslate.y + delta.y,
      },
    }));
  };

  const handleWidgetDataFetched = useCallback(
    (tableData: TableDataWithTitle[]) => {
      const tableMeta = {...tableData[0]!.meta};
      const keys = Object.keys(tableMeta);
      const field = keys[0]!;
      const dataType = tableMeta[field];
      const dataUnit = tableMeta.units?.[field];

      const newState = cloneDeep(thresholdMetaState);
      newState.dataType = dataType;
      newState.dataUnit = dataUnit;
      setThresholdMetaState(newState);
    },
    [thresholdMetaState]
  );

  const preferences = useLegacyStore(PreferencesStore);
  const hasNewNav = organization?.features.includes('navigation-sidebar-v2');
  const sidebarCollapsed = hasNewNav ? true : !!preferences.collapsed;

  return (
    <Fragment>
      {isOpen && <Backdrop style={{opacity: 0.5, pointerEvents: 'auto'}} />}
      <AnimatePresence>
        {isOpen && (
          <WidgetBuilderProvider>
            <CustomMeasurementsProvider organization={organization} selection={selection}>
              <SpanTagsProvider
                dataset={DiscoverDatasets.SPANS_EAP}
                enabled={organization.features.includes('dashboards-eap')}
              >
                <ContainerWithoutSidebar sidebarCollapsed={sidebarCollapsed}>
                  <WidgetBuilderContainer>
                    <WidgetBuilderSlideout
                      isOpen={isOpen}
                      onClose={() => {
                        onClose();
                        setTranslate(DEFAULT_WIDGET_DRAG_POSITIONING);
                      }}
                      onSave={onSave}
                      onQueryConditionChange={setQueryConditionsValid}
                      dashboard={dashboard}
                      dashboardFilters={dashboardFilters}
                      setIsPreviewDraggable={setIsPreviewDraggable}
                      isWidgetInvalid={!queryConditionsValid}
                      openWidgetTemplates={openWidgetTemplates}
                      setOpenWidgetTemplates={setOpenWidgetTemplates}
                      onDataFetched={handleWidgetDataFetched}
                      thresholdMetaState={thresholdMetaState}
                    />
                    {(!isSmallScreen || isPreviewDraggable) && (
                      <DndContext
                        onDragEnd={handleDragEnd}
                        onDragMove={handleDragMove}
                        collisionDetection={closestCorners}
                      >
                        <WidgetPreviewContainer
                          dashboardFilters={dashboardFilters}
                          dashboard={dashboard}
                          dragPosition={translate}
                          isDraggable={isPreviewDraggable}
                          isWidgetInvalid={!queryConditionsValid}
                          onDataFetched={handleWidgetDataFetched}
                        />
                      </DndContext>
                    )}
                  </WidgetBuilderContainer>
                </ContainerWithoutSidebar>
              </SpanTagsProvider>
            </CustomMeasurementsProvider>
          </WidgetBuilderProvider>
        )}
      </AnimatePresence>
    </Fragment>
  );
}

export default WidgetBuilderV2;

export function WidgetPreviewContainer({
  dashboardFilters,
  dashboard,
  isWidgetInvalid,
  dragPosition,
  isDraggable,
  onDataFetched,
}: {
  dashboard: DashboardDetails;
  dashboardFilters: DashboardFilters;
  isWidgetInvalid: boolean;
  dragPosition?: WidgetDragPositioning;
  isDraggable?: boolean;
  onDataFetched?: (tableData: TableDataWithTitle[]) => void;
}) {
  const {state} = useWidgetBuilderContext();
  const organization = useOrganization();
  const location = useLocation();
  const theme = useTheme();
  const {useRpc} = useLocationQuery({
    fields: {
      useRpc: decodeBoolean,
    },
  });

  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.small})`);
  // if small screen and draggable, enable dragging
  const isDragEnabled = isSmallScreen && isDraggable;

  const {attributes, listeners, setNodeRef, isDragging} = useDraggable({
    id: WIDGET_PREVIEW_DRAG_ID,
    disabled: !isDragEnabled,
    // May need to add 'handle' prop if we want to drag the preview by a specific area
  });

  const {translate, top, left} = dragPosition ?? {};

  const draggableStyle: CSSProperties = {
    transform: isDragEnabled
      ? `translate3d(${translate?.x ?? 0}px, ${translate?.y ?? 0}px, 0)`
      : undefined,
    top: isDragEnabled ? top ?? 0 : undefined,
    left: isDragEnabled ? left ?? 0 : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragEnabled ? theme.zIndex.modal : theme.zIndex.initial,
    cursor: isDragEnabled ? 'grab' : undefined,
    margin: isDragEnabled ? '0' : undefined,
    alignSelf: isDragEnabled ? 'flex-start' : undefined,
    position: isDragEnabled ? 'fixed' : undefined,
  };

  const getPreviewHeight = () => {
    if (isDragEnabled) {
      return DRAGGABLE_PREVIEW_HEIGHT_PX;
    }
    if (state.displayType === DisplayType.TABLE) {
      return 'auto';
    }
    if (state.displayType === DisplayType.BIG_NUMBER && !isSmallScreen) {
      return '20vw';
    }
    return PREVIEW_HEIGHT_PX;
  };

  return (
    <DashboardsMEPProvider>
      <MetricsCardinalityProvider organization={organization} location={location}>
        <MetricsDataSwitcher
          organization={organization}
          location={location}
          hideLoadingIndicator
          eventView={EventView.fromLocation(location)}
        >
          {metricsDataSide => (
            <MEPSettingProvider
              location={location}
              forceTransactions={metricsDataSide.forceTransactionsOnly}
            >
              {isDragEnabled && <DroppablePreviewContainer />}
              <DraggableWidgetContainer
                ref={setNodeRef}
                id={WIDGET_PREVIEW_DRAG_ID}
                style={draggableStyle}
                aria-label={t('Draggable Widget Preview')}
                {...attributes}
                {...listeners}
              >
                <SampleWidgetCard
                  initial={{opacity: 0, x: '50%', y: 0}}
                  animate={{opacity: 1, x: 0, y: 0}}
                  exit={{opacity: 0, x: '50%', y: 0}}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 50,
                  }}
                  style={{
                    width: isDragEnabled ? DRAGGABLE_PREVIEW_WIDTH_PX : undefined,
                    height: getPreviewHeight(),
                    outline: isDragEnabled
                      ? `${space(1)} solid ${theme.border}`
                      : undefined,
                  }}
                >
                  <WidgetPreview
                    // While we test out RPC for spans, force a re-render if the spans toggle changes
                    key={state.dataset === WidgetType.SPANS && useRpc ? 'spans' : 'other'}
                    dashboardFilters={dashboardFilters}
                    dashboard={dashboard}
                    isWidgetInvalid={isWidgetInvalid}
                    onDataFetched={onDataFetched}
                  />
                </SampleWidgetCard>
              </DraggableWidgetContainer>
            </MEPSettingProvider>
          )}
        </MetricsDataSwitcher>
      </MetricsCardinalityProvider>
    </DashboardsMEPProvider>
  );
}

function DroppablePreviewContainer() {
  const containers = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

  return (
    <DroppableGrid>
      {containers.map(id => (
        <Droppable key={id} id={id} />
      ))}
    </DroppableGrid>
  );
}

function Droppable({id}: {id: string}) {
  const {setNodeRef} = useDroppable({
    id,
  });

  return <div ref={setNodeRef} id={id} />;
}

const fullPageCss = css`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
`;

const Backdrop = styled('div')`
  ${fullPageCss};
  z-index: ${p => p.theme.zIndex.widgetBuilderDrawer};
  background: ${p => p.theme.black};
  will-change: opacity;
  transition: opacity 200ms;
  pointer-events: none;
  opacity: 0;
`;

const SampleWidgetCard = styled(motion.div)`
  width: 100%;
  min-width: 100%;
  border: 1px dashed ${p => p.theme.gray300};
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => p.theme.background};
  z-index: ${p => p.theme.zIndex.initial};
  position: relative;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    width: 30vw;
    min-width: 300px;
    z-index: ${p => p.theme.zIndex.modal};
    cursor: auto;
  }

  @media (max-width: ${p => p.theme.breakpoints.large}) and (min-width: ${p =>
      p.theme.breakpoints.medium}) {
    width: 25vw;
    min-width: 100px;
    max-width: 300px;
  }
`;

const DraggableWidgetContainer = styled(`div`)`
  align-content: center;
  z-index: ${p => p.theme.zIndex.initial};
  position: relative;
  margin: auto;
  cursor: auto;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    z-index: ${p => p.theme.zIndex.modal};
    transform: none;
    cursor: auto;
  }
`;

const ContainerWithoutSidebar = styled('div')<{sidebarCollapsed: boolean}>`
  z-index: ${p => p.theme.zIndex.widgetBuilderDrawer};
  position: fixed;
  top: 0;
  left: ${p =>
    p.sidebarCollapsed ? p.theme.sidebar.collapsedWidth : p.theme.sidebar.expandedWidth};
  right: 0;
  bottom: 0;

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    left: 0;
    top: ${p => p.theme.sidebar.mobileHeight};
  }
`;

const WidgetBuilderContainer = styled('div')`
  z-index: ${p => p.theme.zIndex.widgetBuilderDrawer};
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: absolute;
  inset: 0;
`;

const DroppableGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  position: fixed;
  gap: ${space(4)};
  margin: ${space(2)};
  top: ${SIDEBAR_HEIGHT}px;
  right: ${space(2)};
  bottom: ${space(2)};
  left: 0;
`;
