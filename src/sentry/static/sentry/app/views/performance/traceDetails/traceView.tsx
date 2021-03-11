import React from 'react';

import * as DividerHandlerManager from 'app/components/events/interfaces/spans/dividerHandlerManager';
import {Panel} from 'app/components/panels';
import {TraceFull} from 'app/utils/performance/quickTrace/types';

import {TraceViewContainer} from './styles';
import TransactionGroup from './transactionGroup';

type Props = {
  trace: TraceFull;
};

class TraceView extends React.Component<Props> {
  traceViewRef = React.createRef<HTMLDivElement>();

  renderTrace() {
    const {trace} = this.props;
    return <TransactionGroup transaction={trace} />;
  }

  render() {
    return (
      <Panel>
        <DividerHandlerManager.Provider interactiveLayerRef={this.traceViewRef}>
          <TraceViewContainer ref={this.traceViewRef}>
            {this.renderTrace()}
          </TraceViewContainer>
        </DividerHandlerManager.Provider>
      </Panel>
    );
  }
}

export default TraceView;
