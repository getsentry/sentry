import {createRef, PureComponent} from 'react';
import {memoize} from 'lodash';
import {Observer} from 'mobx-react';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import * as QuickTraceContext from 'sentry/utils/performance/quickTrace/quickTraceContext';
import {ProfilerWithTasks} from 'sentry/utils/performanceForSentry';

import * as CursorGuideHandler from './cursorGuideHandler';
import * as DividerHandlerManager from './dividerHandlerManager';
import DragManager, {DragManagerChildrenProps} from './dragManager';
import TraceViewHeader from './header';
import * as ScrollbarManager from './scrollbarManager';
import SpanTree from './spanTree';
import {getTraceContext} from './utils';
import WaterfallModel from './waterfallModel';

type Props = {
  organization: Organization;
  waterfallModel: WaterfallModel;
};

class TraceView extends PureComponent<Props> {
  traceViewRef = createRef<HTMLDivElement>();
  virtualScrollBarContainerRef = createRef<HTMLDivElement>();
  minimapInteractiveRef = createRef<HTMLDivElement>();

  generateBounds = memoize((waterfallModel: WaterfallModel) => {
    return waterfallModel.generateBounds({
      viewStart: 0,
      viewEnd: 1,
    });
  });

  getSpans = memoize((waterfallModel: WaterfallModel, organization: Organization) => {
    return waterfallModel.getWaterfall(
      {
        viewStart: 0,
        viewEnd: 1,
      },
      organization.features.includes('performance-autogroup-sibling-spans')
    );
  });

  renderHeader = (dragProps: DragManagerChildrenProps) => (
    <Observer>
      {() => {
        const {waterfallModel, organization} = this.props;

        return (
          <TraceViewHeader
            organization={this.props.organization}
            minimapInteractiveRef={this.minimapInteractiveRef}
            dragProps={dragProps}
            trace={waterfallModel.parsedTrace}
            event={waterfallModel.event}
            virtualScrollBarContainerRef={this.virtualScrollBarContainerRef}
            operationNameFilters={waterfallModel.operationNameFilters}
            rootSpan={waterfallModel.rootSpan.span}
            spans={this.getSpans(waterfallModel, organization)}
            generateBounds={this.generateBounds(waterfallModel)}
          />
        );
      }}
    </Observer>
  );

  render() {
    const {organization, waterfallModel} = this.props;

    if (!getTraceContext(waterfallModel.event)) {
      return (
        <EmptyStateWarning>
          <p>{t('There is no trace for this transaction')}</p>
        </EmptyStateWarning>
      );
    }

    return (
      <DragManager interactiveLayerRef={this.minimapInteractiveRef}>
        {(dragProps: DragManagerChildrenProps) => (
          <Observer>
            {() => {
              const parsedTrace = waterfallModel.parsedTrace;
              return (
                <CursorGuideHandler.Provider
                  interactiveLayerRef={this.minimapInteractiveRef}
                  dragProps={dragProps}
                  trace={parsedTrace}
                >
                  <DividerHandlerManager.Provider interactiveLayerRef={this.traceViewRef}>
                    <DividerHandlerManager.Consumer>
                      {dividerHandlerChildrenProps => {
                        return (
                          <ScrollbarManager.Provider
                            dividerPosition={dividerHandlerChildrenProps.dividerPosition}
                            interactiveLayerRef={this.virtualScrollBarContainerRef}
                            dragProps={dragProps}
                          >
                            {this.renderHeader(dragProps)}
                            <Observer>
                              {() => {
                                return (
                                  <ProfilerWithTasks id="SpanTree">
                                    <QuickTraceContext.Consumer>
                                      {quickTrace => (
                                        <ScrollbarManager.Consumer>
                                          {scrollbarManagerChildrenProps => (
                                            <SpanTree
                                              traceViewRef={this.traceViewRef}
                                              dragProps={dragProps}
                                              organization={organization}
                                              quickTrace={quickTrace}
                                              scrollbarManagerChildrenProps={
                                                scrollbarManagerChildrenProps
                                              }
                                              dividerHandlerChildrenProps={
                                                dividerHandlerChildrenProps
                                              }
                                              waterfallModel={waterfallModel}
                                              filterSpans={waterfallModel.filterSpans}
                                              allSpans={waterfallModel.getWaterfall(
                                                {
                                                  viewStart: 0,
                                                  viewEnd: 1,
                                                },
                                                organization.features.includes(
                                                  'performance-autogroup-sibling-spans'
                                                )
                                              )}
                                              spans={waterfallModel.getWaterfall(
                                                {
                                                  viewStart: dragProps.viewWindowStart,
                                                  viewEnd: dragProps.viewWindowEnd,
                                                },
                                                organization.features.includes(
                                                  'performance-autogroup-sibling-spans'
                                                )
                                              )}
                                            />
                                          )}
                                        </ScrollbarManager.Consumer>
                                      )}
                                    </QuickTraceContext.Consumer>
                                  </ProfilerWithTasks>
                                );
                              }}
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
    );
  }
}

export default TraceView;
