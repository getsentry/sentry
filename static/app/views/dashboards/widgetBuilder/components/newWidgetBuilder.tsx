import {type CSSProperties, Fragment, useCallback, useEffect, useState} from 'react';
import {closestCorners, DndContext, useDraggable, useDroppable} from '@dnd-kit/core';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';
import cloneDeep from 'lodash/cloneDeep';
import omit from 'lodash/omit';

import {prefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  SIDEBAR_MOBILE_HEIGHT,
} from 'sentry/components/sidebar/constants';
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
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  type DashboardDetails,
  type DashboardFilters,
  DisplayType,
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

  const preferences = useLegacyStore(PreferencesStore);
  const sidebarCollapsed = prefersStackedNav() ? true : !!preferences.collapsed;

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
                    <SlideoutContainer>
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
      ? `translate3d(${isDragging ? translate?.x : 0}px, ${isDragging ? translate?.y : 0}px, 0)`
      : undefined,
    top: isDragEnabled ? top ?? 0 : undefined,
    left: isDragEnabled ? left ?? 0 : undefined,
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
                {!isSmallScreen && (
                  <WidgetPreviewTitle
                    initial={{opacity: 0, x: '50%', y: 0}}
                    animate={{opacity: 1, x: 0, y: 0}}
                    exit={{opacity: 0, x: '50%', y: 0}}
                    transition={animationTransitionSettings}
                  >
                    {t('Widget Preview')}
                  </WidgetPreviewTitle>
                )}
                <SampleWidgetCard
                  initial={{opacity: 0, x: '50%', y: 0}}
                  animate={{opacity: 1, x: 0, y: 0}}
                  exit={{opacity: 0, x: '50%', y: 0}}
                  transition={animationTransitionSettings}
                  style={{
                    width: isDragEnabled ? DRAGGABLE_PREVIEW_WIDTH_PX : undefined,
                    height: getPreviewHeight(),
                    outline: isDragEnabled
                      ? `${space(1)} solid ${theme.border}`
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
    width: 40vw;
    min-width: 300px;
    z-index: ${p => p.theme.zIndex.modal};
    cursor: auto;
  }

  @media (max-width: ${p => p.theme.breakpoints.large}) and (min-width: ${p =>
      p.theme.breakpoints.medium}) {
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
  left: ${p => (p.sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH)};
  right: 0;
  bottom: 0;

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    left: 0;
    top: ${SIDEBAR_MOBILE_HEIGHT};
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
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
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

const WidgetPreviewTitle = styled(motion.h5)`
  margin-bottom: ${space(1)};
  margin-left: ${space(1)};
  color: ${p => p.theme.white};
  font-weight: ${p => p.theme.fontWeightBold};
`;
