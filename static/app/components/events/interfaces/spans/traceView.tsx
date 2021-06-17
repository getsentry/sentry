import {createRef, PureComponent} from 'react';
import {Observer} from 'mobx-react';

import EmptyStateWarning from 'app/components/emptyStateWarning';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {EventTransaction} from 'app/types/event';

import * as CursorGuideHandler from './cursorGuideHandler';
import * as DividerHandlerManager from './dividerHandlerManager';
import DragManager, {DragManagerChildrenProps} from './dragManager';
import TraceViewHeader from './header';
import * as ScrollbarManager from './scrollbarManager';
import SpanTree from './spanTree';
import {ParsedTraceType} from './types';
import {getTraceContext} from './utils';
import WaterfallModel from './waterfallModel';

type Props = {
  organization: Organization;
  event: Readonly<EventTransaction>;
  parsedTrace: ParsedTraceType;
  waterfallModel: WaterfallModel;
};

class TraceView extends PureComponent<Props> {
  traceViewRef = createRef<HTMLDivElement>();
  virtualScrollBarContainerRef = createRef<HTMLDivElement>();
  minimapInteractiveRef = createRef<HTMLDivElement>();

  renderHeader = (dragProps: DragManagerChildrenProps, parsedTrace: ParsedTraceType) => (
    <TraceViewHeader
      organization={this.props.organization}
      minimapInteractiveRef={this.minimapInteractiveRef}
      dragProps={dragProps}
      trace={parsedTrace}
      event={this.props.event}
      virtualScrollBarContainerRef={this.virtualScrollBarContainerRef}
      operationNameFilters={this.props.waterfallModel.operationNameFilters}
    />
  );

  render() {
    const {event, parsedTrace} = this.props;

    if (!getTraceContext(event)) {
      return (
        <EmptyStateWarning>
          <p>{t('There is no trace for this transaction')}</p>
        </EmptyStateWarning>
      );
    }

    const {organization, waterfallModel} = this.props;

    return (
      <DragManager interactiveLayerRef={this.minimapInteractiveRef}>
        {(dragProps: DragManagerChildrenProps) => (
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
                      {this.renderHeader(dragProps, parsedTrace)}
                      <Observer>
                        {() => (
                          <SpanTree
                            traceViewRef={this.traceViewRef}
                            event={event}
                            trace={parsedTrace}
                            dragProps={dragProps}
                            filterSpans={waterfallModel.filterSpans}
                            organization={organization}
                            operationNameFilters={waterfallModel.operationNameFilters}
                          />
                        )}
                      </Observer>
                    </ScrollbarManager.Provider>
                  );
                }}
              </DividerHandlerManager.Consumer>
            </DividerHandlerManager.Provider>
          </CursorGuideHandler.Provider>
        )}
      </DragManager>
    );
  }
}

export default TraceView;
