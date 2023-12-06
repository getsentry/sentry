import {createRef, memo, useEffect, useState} from 'react';
import {Observer} from 'mobx-react';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {TracePerformanceIssue} from 'sentry/utils/performance/quickTrace/types';

import * as CursorGuideHandler from './cursorGuideHandler';
import * as DividerHandlerManager from './dividerHandlerManager';
import DragManager, {DragManagerChildrenProps} from './dragManager';
import TraceViewHeader from './header';
import * as ScrollbarManager from './scrollbarManager';
import * as SpanContext from './spanContext';
import SpanTree from './spanTree';
import {getTraceContext} from './utils';
import WaterfallModel from './waterfallModel';

type Props = {
  organization: Organization;
  waterfallModel: WaterfallModel;
  isAggregate?: boolean;
  isEmbedded?: boolean;
  performanceIssues?: TracePerformanceIssue[];
};

function TraceView(props: Props) {
  const traceViewRef = createRef<HTMLDivElement>();
  const traceViewHeaderRef = createRef<HTMLDivElement>();
  const virtualScrollBarContainerRef = createRef<HTMLDivElement>();
  const minimapInteractiveRef = createRef<HTMLDivElement>();

  const [isMounted, setIsMounted] = useState(false);

  // Since this component is memoized, we need this hook here.
  // renderHeader performs some expensive calculations and so we only want to render once, hence why we memoize.
  // However, the virtualScrollbar will not be visible unless we have this effect here. This is a bit of a hack that will
  // cause the component to rerender by setting the isMounted state, so we will re-render only once the scrollbar ref is present.
  useEffect(() => {
    if (virtualScrollBarContainerRef.current && !isMounted) {
      setIsMounted(true);
    }
  }, [virtualScrollBarContainerRef, isMounted]);

  const renderHeader = (dragProps: DragManagerChildrenProps) => (
    <Observer>
      {() => {
        const {waterfallModel} = props;

        return (
          <TraceViewHeader
            traceViewHeaderRef={traceViewHeaderRef}
            organization={props.organization}
            minimapInteractiveRef={minimapInteractiveRef}
            dragProps={dragProps}
            trace={waterfallModel.parsedTrace}
            event={waterfallModel.event}
            virtualScrollBarContainerRef={virtualScrollBarContainerRef}
            operationNameFilters={waterfallModel.operationNameFilters}
            rootSpan={waterfallModel.rootSpan.span}
            spans={waterfallModel.getWaterfall({
              viewStart: 0,
              viewEnd: 1,
            })}
            generateBounds={waterfallModel.generateBounds({
              viewStart: 0,
              viewEnd: 1,
            })}
          />
        );
      }}
    </Observer>
  );

  const {organization, waterfallModel, isEmbedded, performanceIssues} = props;

  if (!getTraceContext(waterfallModel.event)) {
    return (
      <EmptyStateWarning>
        <p>{t('There is no trace for this transaction')}</p>
      </EmptyStateWarning>
    );
  }
  if (
    (!waterfallModel.affectedSpanIds || !waterfallModel.affectedSpanIds.length) &&
    performanceIssues
  ) {
    const suspectSpans = performanceIssues.map(issue => issue.suspect_spans).flat();
    if (suspectSpans.length) {
      waterfallModel.affectedSpanIds = performanceIssues
        .map(issue => [...issue.suspect_spans, ...issue.span])
        .flat();
    }
  }

  return (
    <SpanContext.Provider>
      <SpanContext.Consumer>
        {spanContextProps => (
          <DragManager interactiveLayerRef={minimapInteractiveRef}>
            {(dragProps: DragManagerChildrenProps) => (
              <Observer>
                {() => {
                  const parsedTrace = waterfallModel.parsedTrace;
                  return (
                    <CursorGuideHandler.Provider
                      interactiveLayerRef={minimapInteractiveRef}
                      dragProps={dragProps}
                      trace={parsedTrace}
                    >
                      <DividerHandlerManager.Provider interactiveLayerRef={traceViewRef}>
                        <DividerHandlerManager.Consumer>
                          {dividerHandlerChildrenProps => {
                            return (
                              <ScrollbarManager.Provider
                                dividerPosition={
                                  dividerHandlerChildrenProps.dividerPosition
                                }
                                interactiveLayerRef={virtualScrollBarContainerRef}
                                dragProps={dragProps}
                                isEmbedded={isEmbedded}
                              >
                                {renderHeader(dragProps)}
                                <Observer>
                                  {() => (
                                    <SpanTree
                                      traceViewRef={traceViewRef}
                                      traceViewHeaderRef={traceViewHeaderRef}
                                      dragProps={dragProps}
                                      organization={organization}
                                      waterfallModel={waterfallModel}
                                      filterSpans={waterfallModel.filterSpans}
                                      spans={waterfallModel.getWaterfall({
                                        viewStart: dragProps.viewWindowStart,
                                        viewEnd: dragProps.viewWindowEnd,
                                      })}
                                      focusedSpanIds={waterfallModel.focusedSpanIds}
                                      spanContextProps={spanContextProps}
                                      operationNameFilters={
                                        waterfallModel.operationNameFilters
                                      }
                                    />
                                  )}
                                </Observer>
                              </ScrollbarManager.Provider>
                            );
                          }}
                        </DividerHandlerManager.Consumer>
                      </DividerHandlerManager.Provider>
                    </CursorGuideHandler.Provider>
                  );
                }}
              </Observer>
            )}
          </DragManager>
        )}
      </SpanContext.Consumer>
    </SpanContext.Provider>
  );
}

export default memo(TraceView);
