import React from 'react';

import {Event} from 'app/types';
import {t} from 'app/locale';
import ErrorBoundary from 'app/components/errorBoundary';
import EventDataSection from 'app/components/events/eventDataSection';
import KeyValueList from 'app/components/events/interfaces/keyValueList';
import SentryTypes from 'app/sentryTypes';

type Props = {
  event: Event;
};

type State = {
  raw: boolean;
};

class EventExtraData extends React.Component<Props, State> {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
  };

  state: State = {
    raw: false,
  };

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    return this.props.event.id !== nextProps.event.id || this.state.raw !== nextState.raw;
  }

  toggleRaw = (shouldBeRaw: boolean) => {
    this.setState({
      raw: shouldBeRaw,
    });
  };

  render() {
    const extraDataArray = Object.entries(this.props.event.context || {});

    return (
      <div className="extra-data">
        <EventDataSection
          type="extra"
          title={t('Additional Data')}
          toggleRaw={this.toggleRaw}
          raw={this.state.raw}
        >
          <ErrorBoundary mini>
            <KeyValueList data={extraDataArray} isContextData raw={this.state.raw} />
          </ErrorBoundary>
        </EventDataSection>
      </div>
    );
  }
}

export default EventExtraData;
