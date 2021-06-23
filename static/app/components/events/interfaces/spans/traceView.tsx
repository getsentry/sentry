import {createRef, PureComponent} from 'react';
import {Observer} from 'mobx-react';

import EmptyStateWarning from 'app/components/emptyStateWarning';
import {t} from 'app/locale';
import {Organization} from 'app/types';

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

  renderHeader = (dragProps: DragManagerChildrenProps) => (
    <Observer>
      {() => {
        const {waterfallModel} = this.props;

        return (
          <TraceViewHeader
            organization={this.props.organization}
            minimapInteractiveRef={this.minimapInteractiveRef}
            dragProps={dragProps}
            trace={waterfallModel.parsedTrace}
            event={waterfallModel.event}
            virtualScrollBarContainerRef={this.virtualScrollBarContainerRef}
            operationNameFilters={waterfallModel.operationNameFilters}
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
                                  <SpanTree
                                    traceViewRef={this.traceViewRef}
                                    dragProps={dragProps}
                                    organization={organization}
                                    waterfallModel={waterfallModel}
                                    filterSpans={waterfallModel.filterSpans}
                                    spans={waterfallModel.getWaterfall({
                                      viewStart: dragProps.viewWindowStart,
                                      viewEnd: dragProps.viewWindowEnd,
                                    })}
                                  />
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
