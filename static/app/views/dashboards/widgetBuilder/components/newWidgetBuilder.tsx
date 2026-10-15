import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import {closestCorners, DndContext} from '@dnd-kit/core';
import {css, Global, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence} from 'framer-motion';

import {Backdrop} from '@sentry/scraps/backdrop';
import {Flex} from '@sentry/scraps/layout';

import {useDimensions} from 'sentry/utils/useDimensions';
import {useMedia} from 'sentry/utils/useMedia';
import {
  type DashboardDetails,
  type DashboardFilters,
  type Widget,
} from 'sentry/views/dashboards/types';
import {
  DEFAULT_WIDGET_DRAG_POSITIONING,
  snapPreviewToCorners,
} from 'sentry/views/dashboards/widgetBuilder/components/common/draggableUtils';
import {WidgetBuilderSlideout} from 'sentry/views/dashboards/widgetBuilder/components/widgetBuilderSlideout';
import {WidgetPreviewContainer} from 'sentry/views/dashboards/widgetBuilder/components/widgetPreviewContainer';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import type {OnDataFetchedParams} from 'sentry/views/dashboards/widgetCard';
import {useTopOffset} from 'sentry/views/navigation/useTopOffset';

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
  widgetInterval?: string;
};

export function WidgetBuilderV2({
  isOpen,
  onClose,
  onSave,
  dashboardFilters,
  dashboard,
  setOpenWidgetTemplates,
  openWidgetTemplates,
  widgetInterval,
}: WidgetBuilderV2Props) {
  const [queryConditionsValid, setQueryConditionsValid] = useState(true);
  const theme = useTheme();
  const [isPreviewDraggable, setIsPreviewDraggable] = useState(false);
  const [thresholdMetaState, setThresholdMetaState] = useState<ThresholdMetaState>({});

  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.sm})`);
  const isMediumScreen = useMedia(`(max-width: ${theme.breakpoints.md})`);

  const [translate, setTranslate] = useState(DEFAULT_WIDGET_DRAG_POSITIONING);

  const navigationElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navigationElementRef.current) {
      return;
    }

    const navigationElement = document.querySelector(
      '[data-navigation-component="navigation-layout"]'
    );
    if (navigationElement) {
      navigationElementRef.current = navigationElement as HTMLDivElement;
    }
  }, []);

  const {contentTop} = useTopOffset();

  const dimensions = useDimensions({elementRef: navigationElementRef});

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

  const handleWidgetDataFetched = useCallback((results: OnDataFetchedParams) => {
    let dataType: string | undefined;
    let dataUnit: string | undefined;

    if (results.tableResults?.length) {
      const tableMeta = {...results.tableResults[0]!.meta};
      const keys = Object.keys(tableMeta);
      const field = keys[0]!;
      dataType = tableMeta[field];
      dataUnit = tableMeta.units?.[field];
    } else if (results.timeseriesResultsTypes) {
      const keys = Object.keys(results.timeseriesResultsTypes);
      dataType = results.timeseriesResultsTypes[keys[0]!];
      const rawUnit = results.timeseriesResultsUnits?.[keys[0]!];
      dataUnit = rawUnit ?? undefined;
    }

    setThresholdMetaState({dataType, dataUnit});
  }, []);

  // reset the drag position when the draggable preview is not visible
  useEffect(() => {
    if (!isPreviewDraggable) {
      // oxlint-disable-next-line react/set-state-in-effect
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
          <Backdrop zIndex="widgetBuilderDrawer" />
          <WidgetBuilderProvider>
            <ContainerWithoutSidebar
              data-test-id="widget-builder-container"
              style={
                // oxlint-disable-next-line react/refs
                navigationElementRef.current
                  ? isMediumScreen
                    ? {
                        left: 0,
                        top: contentTop,
                        willChange: 'top',
                      }
                    : {
                        left: `${dimensions.width ?? 0}px`,
                        top: contentTop,
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
                    widgetInterval={widgetInterval}
                    setIsPreviewDraggable={setIsPreviewDraggable}
                    isQueryConditionInvalid={!queryConditionsValid}
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
                    <Flex justify="center" align="center" width="100%" height="100%">
                      <WidgetPreviewContainer
                        dashboardFilters={dashboardFilters}
                        dashboard={dashboard}
                        widgetInterval={widgetInterval}
                        dragPosition={translate}
                        isDraggable={isPreviewDraggable}
                        isQueryConditionInvalid={!queryConditionsValid}
                        onDataFetched={handleWidgetDataFetched}
                        openWidgetTemplates={openWidgetTemplates}
                      />
                    </Flex>
                  </DndContext>
                )}
              </WidgetBuilderContainer>
            </ContainerWithoutSidebar>
          </WidgetBuilderProvider>
        </Fragment>
      )}
    </AnimatePresence>
  );
}

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

const SlideoutContainer = styled('div')`
  height: 100%;
`;
