import React from 'react';

import DragManager, {DragManagerChildrenProps} from './dragManager';
import SpanTree from './span_tree';
import {SentryEvent} from './types';

import TraceViewMinimap from './minimap';

type TransactionViewProps = {
  event: SentryEvent;
};

type TransactionViewState = {
  renderMinimap: boolean;
};

class TransactionView extends React.Component<
  TransactionViewProps,
  TransactionViewState
> {
  minimapInteractiveRef = React.createRef<HTMLDivElement>();
  traceViewRef = React.createRef<HTMLDivElement>();

  state: TransactionViewState = {
    renderMinimap: false,
  };

  componentDidMount() {
    if (this.traceViewRef.current) {
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({
        renderMinimap: true,
      });
    }
  }

  renderMinimap = (dragProps: DragManagerChildrenProps) => {
    if (!this.state.renderMinimap) {
      return null;
    }

    return (
      <TraceViewMinimap
        traceViewRef={this.traceViewRef}
        minimapInteractiveRef={this.minimapInteractiveRef}
        dragProps={dragProps}
      />
    );
  };

  render() {
    return (
      <DragManager interactiveLayerRef={this.minimapInteractiveRef}>
        {(dragProps: DragManagerChildrenProps) => {
          return (
            <React.Fragment>
              {this.renderMinimap(dragProps)}
              <SpanTree
                traceViewRef={this.traceViewRef}
                event={this.props.event}
                dragProps={dragProps}
              />
            </React.Fragment>
          );
        }}
      </DragManager>
    );
  }
}

export default TransactionView;
