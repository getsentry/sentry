import {Fragment, useEffect, useState} from 'react';
import {DndContext, type Translate, useDraggable} from '@dnd-kit/core';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {CustomMeasurementsProvider} from 'sentry/utils/customMeasurements/customMeasurementsProvider';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
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
} from 'sentry/views/dashboards/types';
import WidgetBuilderSlideout from 'sentry/views/dashboards/widgetBuilder/components/widgetBuilderSlideout';
import WidgetPreview from 'sentry/views/dashboards/widgetBuilder/components/widgetPreview';
import {
  useWidgetBuilderContext,
  WidgetBuilderProvider,
} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {DashboardsMEPProvider} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';
import {MetricsDataSwitcher} from 'sentry/views/performance/landing/metricsDataSwitcher';

type WidgetBuilderV2Props = {
  dashboard: DashboardDetails;
  dashboardFilters: DashboardFilters;
  isOpen: boolean;
  onClose: () => void;
  onSave: ({index, widget}: {index: number; widget: Widget}) => void;
};

const WIDGET_PREVIEW_DRAG_ID = 'widget-preview-draggable';

function WidgetBuilderV2({
  isOpen,
  onClose,
  onSave,
  dashboardFilters,
  dashboard,
}: WidgetBuilderV2Props) {
  const escapeKeyPressed = useKeyPress('Escape');
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const [queryConditionsValid, setQueryConditionsValid] = useState<boolean>(true);
  const theme = useTheme();
  const [isPreviewDraggable, setIsPreviewDraggable] = useState(false);

  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.small})`);

  const [{translate}, setTranslate] = useState<{
    initialTranslate: Translate;
    translate: Translate;
  }>({
    initialTranslate: {x: 0, y: 0},
    translate: {x: 0, y: 0},
  });

  useEffect(() => {
    if (escapeKeyPressed) {
      if (isOpen) {
        onClose?.();
      }
    }
  }, [escapeKeyPressed, isOpen, onClose]);

  const handleDragEnd = () => {
    setTranslate(({translate: newTranslate}) => {
      return {
        translate: newTranslate,
        initialTranslate: newTranslate,
      };
    });
  };

  const handleDragMove = ({delta}) => {
    setTranslate(({initialTranslate}) => ({
      initialTranslate,
      translate: {
        x: initialTranslate.x + delta.x,
        y: initialTranslate.y + delta.y,
      },
    }));
  };

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
                <ContainerWithoutSidebar>
                  <WidgetBuilderContainer>
                    <WidgetBuilderSlideout
                      isOpen={isOpen}
                      onClose={() => {
                        onClose();
                        setTranslate({
                          initialTranslate: {x: 0, y: 0},
                          translate: {x: 0, y: 0},
                        });
                      }}
                      onSave={onSave}
                      onQueryConditionChange={setQueryConditionsValid}
                      dashboard={dashboard}
                      dashboardFilters={dashboardFilters}
                      setIsPreviewDraggable={setIsPreviewDraggable}
                      isWidgetInvalid={!queryConditionsValid}
                    />
                    {(!isSmallScreen || isPreviewDraggable) && (
                      <DndContext onDragEnd={handleDragEnd} onDragMove={handleDragMove}>
                        <WidgetPreviewContainer
                          dashboardFilters={dashboardFilters}
                          dashboard={dashboard}
                          translate={translate}
                          isDraggable={isPreviewDraggable}
                          isWidgetInvalid={!queryConditionsValid}
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
  translate,
  isDraggable,
}: {
  dashboard: DashboardDetails;
  dashboardFilters: DashboardFilters;
  isWidgetInvalid: boolean;
  isDraggable?: boolean;
  translate?: Translate;
}) {
  const {state} = useWidgetBuilderContext();
  const organization = useOrganization();
  const location = useLocation();
  const theme = useTheme();

  // if small screen and draggable, enable dragging
  const isDragEnabled =
    window.innerWidth < parseInt(theme.breakpoints.small.replace('px', ''), 10) &&
    isDraggable;

  const {attributes, listeners, setNodeRef, isDragging} = useDraggable({
    id: WIDGET_PREVIEW_DRAG_ID,
    disabled: !isDragEnabled,
    // May need to add 'handle' prop if we want to drag the preview by a specific area
  });

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
              <DraggableWidgetContainer
                ref={setNodeRef}
                id={WIDGET_PREVIEW_DRAG_ID}
                style={{
                  transform: isDragEnabled
                    ? `translate3d(${translate?.x ?? 0}px, ${translate?.y ?? 0}px, 0)`
                    : undefined,
                  opacity: isDragging ? 0.5 : 1,
                  zIndex: isDragEnabled ? theme.zIndex.modal : theme.zIndex.initial,
                  cursor: isDragEnabled ? 'grab' : undefined,
                }}
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
                    width: isDragEnabled ? '300px' : undefined,
                    height:
                      isDragEnabled && state.displayType !== DisplayType.TABLE
                        ? '200px'
                        : state.displayType === DisplayType.TABLE
                          ? 'auto'
                          : '400px',
                  }}
                >
                  <WidgetPreview
                    dashboardFilters={dashboardFilters}
                    dashboard={dashboard}
                    isWidgetInvalid={isWidgetInvalid}
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
  border: 2px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => p.theme.background};
  z-index: ${p => p.theme.zIndex.initial};
  position: relative;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    width: 30vw;
    min-width: 400px;
    z-index: ${p => p.theme.zIndex.modal};
    cursor: auto;
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

const ContainerWithoutSidebar = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
`;

const WidgetBuilderContainer = styled('div')`
  z-index: ${p => p.theme.zIndex.widgetBuilderDrawer};
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100vh;
  position: fixed;
  width: -webkit-fill-available; /* Chrome */
  width: -moz-available; /* Firefox */
  width: fill-available; /* others */
`;
