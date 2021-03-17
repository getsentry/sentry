import React from 'react';

import * as DividerHandlerManager from 'app/components/events/interfaces/spans/dividerHandlerManager';
import {Panel} from 'app/components/panels';
import {TraceFull} from 'app/utils/performance/quickTrace/types';

import {TraceViewContainer} from './styles';
import TransactionGroup from './transactionGroup';
import {TraceInfo} from './types';

type Props = {
  trace: TraceFull;
  traceInfo: TraceInfo;
};

class TraceView extends React.Component<Props> {
  traceViewRef = React.createRef<HTMLDivElement>();

  render() {
    const {trace, traceInfo} = this.props;

    return (
      <Panel>
        <DividerHandlerManager.Provider interactiveLayerRef={this.traceViewRef}>
          <TraceViewContainer ref={this.traceViewRef}>
            <TransactionGroup transaction={trace} traceInfo={traceInfo} />
          </TraceViewContainer>
        </DividerHandlerManager.Provider>
      </Panel>
    );
  }
}

export default TraceView;
