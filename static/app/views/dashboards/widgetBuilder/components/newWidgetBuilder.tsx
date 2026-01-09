import {Fragment, useCallback, useEffect, useState, type CSSProperties} from 'react';
import {closestCorners, DndContext, useDraggable, useDroppable} from '@dnd-kit/core';
import {css, Global, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion, type MotionNodeAnimationOptions} from 'framer-motion';
import cloneDeep from 'lodash/cloneDeep';
import omit from 'lodash/omit';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {CustomMeasurementsProvider} from 'sentry/utils/customMeasurements/customMeasurementsProvider';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useHasTraceMetricsDashboards} from 'sentry/views/dashboards/hooks/useHasTraceMetricsDashboards';
import {
  DisplayType,
  WidgetType,
  type DashboardDetails,
  type DashboardFilters,
  type Widget,
} from 'sentry/views/dashboards/types';
import {animationTransitionSettings} from 'sentry/views/dashboards/widgetBuilder/components/common/animationSettings';
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
import WidgetBuilderFilterBar from 'sentry/views/dashboards/widgetBuilder/components/filtersBar';
import WidgetBuilderSlideout from 'sentry/views/dashboards/widgetBuilder/components/widgetBuilderSlideout';
import WidgetPreview from 'sentry/views/dashboards/widgetBuilder/components/widgetPreview';
import {
  useWidgetBuilderContext,
  WidgetBuilderProvider,
} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {DashboardsMEPProvider} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import {createTraceMetricFilter} from 'sentry/views/explore/metrics/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {useNavContext} from 'sentry/views/nav/context';
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
  onSave: ({index, widget}: {index: number | undefined; widget: Widget}) => void;
  openWidgetTemplates: boolean;
  setOpenWidgetTemplates: (openWidgetTemplates: boolean) => void;
};

function TraceItemAttributeProviderFromDataset({children}: {children: React.ReactNode}) {
  const {state} = useWidgetBuilderContext();
  const organization = useOrganization();
  const hasTraceMetricsDashboards = useHasTraceMetricsDashboards();

  let enabled = false;
  let traceItemType = TraceItemDataset.SPANS;
  let query = undefined;

  if (state.dataset === WidgetType.SPANS) {
    enabled = organization.features.includes('visibility-explore-view');
    traceItemType = TraceItemDataset.SPANS;
  }

  if (state.dataset === WidgetType.LOGS) {
    enabled = isLogsEnabled(organization);
    traceItemType = TraceItemDataset.LOGS;
  }

  if (state.dataset === WidgetType.TRACEMETRICS && state.traceMetric) {
    enabled = hasTraceMetricsDashboards;
    traceItemType = TraceItemDataset.TRACEMETRICS;
    query = createTraceMetricFilter(state.traceMetric);
  }

  return (
    <TraceItemAttributeProvider
      traceItemType={traceItemType}
      enabled={enabled}
      query={query}
    >
      {children}
    </TraceItemAttributeProvider>
  );
}

function WidgetBuilderV2({
  isOpen,
  onClose,
  onSave,
  dashboardFilters,
  dashboard,
  setOpenWidgetTemplates,
  openWidgetTemplates,
}: WidgetBuilderV2Props) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const [queryConditionsValid, setQueryConditionsValid] = useState<boolean>(true);
  const theme = useTheme();
  const [isPreviewDraggable, setIsPreviewDraggable] = useState(false);
  const [thresholdMetaState, setThresholdMetaState] = useState<ThresholdMetaState>({});

  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.sm})`);
  const isMediumScreen = useMedia(`(max-width: ${theme.breakpoints.md})`);

  const [translate, setTranslate] = useState<WidgetDragPositioning>(
    DEFAULT_WIDGET_DRAG_POSITIONING
  );

  const {navParentRef} = useNavContext();
  // Check if we have a valid nav reference
  const hasValidNav = Boolean(navParentRef?.current);

  const dimensions = useDimensions({elementRef: navParentRef});

  const handleDragEnd = ({over}: any) => {
    setTranslate(snapPreviewToCorners(over));
  };

  const handleDragMove = ({delta}: any) => {
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

  // reset the drag position when the draggable preview is not visible
  useEffect(() => {
    if (!isPreviewDraggable) {
      setTranslate(DEFAULT_WIDGET_DRAG_POSITIONING);
    }
  }, [isPreviewDraggable]);

  return (
    <AnimatePresence>
      {isOpen && (
        <Fragment>
          <Global
            styles={css`
              body {
                overflow: hidden;
              }
            `}
          />
          <Backdrop style={{opacity: 0.5, pointerEvents: 'auto'}} />
          <WidgetBuilderProvider>
            <CustomMeasurementsProvider organization={organization} selection={selection}>
              <TraceItemAttributeProviderFromDataset>
                <ContainerWithoutSidebar
                  style={
                    hasValidNav
                      ? isMediumScreen
                        ? {
                            left: 0,
                            top: `${dimensions.height ?? 0}px`,
                            willChange: 'top',
                          }
                        : {
                            left: `${dimensions.width ?? 0}px`,
                            top: 0,
                            willChange: 'left',
                          }
                      : undefined
                  }
                >
                  <WidgetBuilderContainer>
                    <SlideoutContainer>
                      <WidgetBuilderSlideout
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
                    </SlideoutContainer>
                    {(!isSmallScreen || isPreviewDraggable) && (
                      <DndContext
                        onDragEnd={handleDragEnd}
                        onDragMove={handleDragMove}
                        collisionDetection={closestCorners}
                      >
                        <SurroundingWidgetContainer>
                          <WidgetPreviewContainer
                            dashboardFilters={dashboardFilters}
                            dashboard={dashboard}
                            dragPosition={translate}
                            isDraggable={isPreviewDraggable}
                            isWidgetInvalid={!queryConditionsValid}
                            onDataFetched={handleWidgetDataFetched}
                            openWidgetTemplates={openWidgetTemplates}
                          />
                        </SurroundingWidgetContainer>
                      </DndContext>
                    )}
                  </WidgetBuilderContainer>
                </ContainerWithoutSidebar>
              </TraceItemAttributeProviderFromDataset>
            </CustomMeasurementsProvider>
          </WidgetBuilderProvider>
        </Fragment>
      )}
    </AnimatePresence>
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
  openWidgetTemplates,
}: {
  dashboard: DashboardDetails;
  dashboardFilters: DashboardFilters;
  isWidgetInvalid: boolean;
  dragPosition?: WidgetDragPositioning;
  isDraggable?: boolean;
  onDataFetched?: (tableData: TableDataWithTitle[]) => void;
  openWidgetTemplates?: boolean;
}) {
  const {state} = useWidgetBuilderContext();
  const organization = useOrganization();
  const location = useLocation();
  const theme = useTheme();
  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.sm})`);
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
      ? `translate3d(${isDragging ? translate?.x : 0}px, ${isDragging ? translate?.y : 0}px, 0)`
      : undefined,
    top: isDragEnabled ? (top ?? 0) : undefined,
    left: isDragEnabled ? (left ?? 0) : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragEnabled
      ? theme.zIndex.modal
      : isSmallScreen
        ? theme.zIndex.initial
        : // if not responsive, set z-index to default in styled component
          undefined,
    cursor: isDragEnabled ? 'grab' : undefined,
    margin: isDragEnabled ? '0' : undefined,
    alignSelf: isDragEnabled ? 'flex-start' : undefined,
    position: isDragEnabled ? 'fixed' : undefined,
  };

  // check if the state is in the url because the state variable has default values
  const hasUrlParams =
    Object.keys(
      omit(location.query, [
        'environment',
        'project',
        'release',
        'start',
        'end',
        'statsPeriod',
      ])
    ).length > 0;

  const getPreviewHeight = () => {
    if (isDragEnabled) {
      return DRAGGABLE_PREVIEW_HEIGHT_PX;
    }
    // if none of the widget templates are selected
    if (openWidgetTemplates && !hasUrlParams) {
      return PREVIEW_HEIGHT_PX;
    }
    if (state.displayType === DisplayType.TABLE) {
      return 'auto';
    }
    if (state.displayType === DisplayType.BIG_NUMBER && !isSmallScreen) {
      return '20vw';
    }
    return PREVIEW_HEIGHT_PX;
  };

  const animatedProps: MotionNodeAnimationOptions = {
    initial: {opacity: 0, transform: 'translateX(100%) translateY(0)'},
    animate: {opacity: 1, transform: 'translateX(0) translateY(0)'},
    exit: {opacity: 0, transform: 'translateX(100%) translateY(0)'},
    transition: animationTransitionSettings,
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
                aria-label={t('Draggable Preview')}
                {...attributes}
                {...listeners}
              >
                <SampleWidgetCard
                  {...animatedProps}
                  style={{
                    width: isDragEnabled ? DRAGGABLE_PREVIEW_WIDTH_PX : undefined,
                    height: getPreviewHeight(),
                    outline: isDragEnabled
                      ? `${space(1)} solid ${theme.tokens.border.primary}`
                      : undefined,
                  }}
                >
                  {openWidgetTemplates && !hasUrlParams ? (
                    <WidgetPreviewPlaceholder>
                      <h6 style={{margin: 0}}>{t('Widget Title')}</h6>
                      <TemplateWidgetPreviewPlaceholder>
                        <p style={{margin: 0}}>{t('Select a widget to preview')}</p>
                      </TemplateWidgetPreviewPlaceholder>
                    </WidgetPreviewPlaceholder>
                  ) : (
                    <WidgetPreview
                      dashboardFilters={dashboardFilters}
                      dashboard={dashboard}
                      isWidgetInvalid={isWidgetInvalid}
                      onDataFetched={onDataFetched}
                      shouldForceDescriptionTooltip={!isSmallScreen}
                    />
                  )}
                </SampleWidgetCard>

                {!isSmallScreen && (
                  <FilterBarContainer {...animatedProps}>
                    <WidgetBuilderFilterBar releases={dashboard.filters?.release ?? []} />
                  </FilterBarContainer>
                )}
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
  position: absolute;
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
  border: 1px dashed ${p => p.theme.colors.gray400};
  background-color: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
  z-index: ${p => p.theme.zIndex.initial};
  position: relative;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    width: 40vw;
    min-width: 300px;
    z-index: ${p => p.theme.zIndex.modal};
    cursor: auto;
  }

  @media (max-width: ${p => p.theme.breakpoints.lg}) and (min-width: ${p =>
      p.theme.breakpoints.md}) {
    width: 30vw;
    min-width: 100px;
  }
`;

const DraggableWidgetContainer = styled(`div`)`
  align-content: center;
  z-index: ${p => p.theme.zIndex.initial};
  position: relative;
  margin: auto;
  cursor: auto;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    z-index: ${p => p.theme.zIndex.modal};
    transform: none;
    cursor: auto;
  }
`;

const ContainerWithoutSidebar = styled('div')`
  z-index: ${p => p.theme.zIndex.widgetBuilderDrawer};
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    left: 0;
  }
`;

const WidgetBuilderContainer = styled('div')`
  z-index: ${p => p.theme.zIndex.widgetBuilderDrawer};
  display: flex;
  align-items: center;
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

const TemplateWidgetPreviewPlaceholder = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 95%;
  color: ${p => p.theme.subText};
  font-style: italic;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const WidgetPreviewPlaceholder = styled('div')`
  width: 100%;
  height: 100%;
  padding: ${space(2)};
`;

const SlideoutContainer = styled('div')`
  height: 100%;
`;

const SurroundingWidgetContainer = styled('div')`
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const FilterBarContainer = styled(motion.div)`
  margin-top: ${space(1)};
  background-color: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    width: 40vw;
    min-width: 300px;
    z-index: ${p => p.theme.zIndex.modal};
    cursor: auto;
  }

  @media (max-width: ${p => p.theme.breakpoints.lg}) and (min-width: ${p =>
      p.theme.breakpoints.md}) {
    width: 30vw;
    min-width: 100px;
  }
`;
