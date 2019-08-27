import React from 'react';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';

import {Panel, PanelHeader, PanelBody} from 'app/components/panels';

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
        <PanelHeader disablePadding={false} hasButtons={false}>
          {t('Trace View - This Transaction')}
        </PanelHeader>
        <PanelBody>
          <TraceView event={event} />
        </PanelBody>
      </Panel>
    );
  }
}

export default SpansInterface;
