import React from 'react';
// TODO: remove
// import PropTypes from 'prop-types';

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
    // TODO: necessary?
    // type: PropTypes.oneOf(['spans']).isRequired,
    // data: PropTypes.arrayOf(
    //   PropTypes.shape({
    //     trace_id: PropTypes.string.isRequired,
    //     parent_span_id: PropTypes.string,
    //     span_id: PropTypes.string.isRequired,
    //     start_timestamp: PropTypes.number.isRequired,
    //     timestamp: PropTypes.number.isRequired, // same as end_timestamp
    //     same_process_as_parent: PropTypes.bool.isRequired,
    //     op: PropTypes.string.isRequired,
    //     data: PropTypes.object.isRequired,
    //   })
    // ).isRequired,
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
