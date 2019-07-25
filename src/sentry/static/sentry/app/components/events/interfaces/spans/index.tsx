import React from 'react';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';

import {Panel, PanelHeader, PanelBody} from 'app/components/panels';

import {SpanEntry, SentryEvent} from './types';
import TransactionView from './transactionView';

type SpansInterfacePropTypes = {
  event: SentryEvent;
} & SpanEntry;

class SpansInterface extends React.Component<SpansInterfacePropTypes> {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
  };
  render() {
    const {event} = this.props;

    return (
      <Panel>
        <PanelHeader disablePadding={false} hasButtons={false}>
          {t('Trace View')}
        </PanelHeader>
        <PanelBody>
          <TransactionView event={event} />
        </PanelBody>
      </Panel>
    );
  }
}

export default SpansInterface;
