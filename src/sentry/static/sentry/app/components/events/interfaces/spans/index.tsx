import React from 'react';
import SentryTypes from 'app/sentryTypes';

import {Panel} from 'app/components/panels';

import {SentryTransactionEvent} from './types';
import TraceView from './traceView';

type PropType = {
  event: SentryTransactionEvent;
};

class SpansInterface extends React.Component<PropType> {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
  };
  render() {
    const {event} = this.props;

    return (
      <Panel>
        <TraceView event={event} />
      </Panel>
    );
  }
}

export default SpansInterface;
