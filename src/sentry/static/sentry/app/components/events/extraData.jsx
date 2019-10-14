import React from 'react';

import {t} from 'app/locale';
import ErrorBoundary from 'app/components/errorBoundary';
import EventDataSection from 'app/components/events/eventDataSection';
import KeyValueList from 'app/components/events/interfaces/keyValueList';
import SentryTypes from 'app/sentryTypes';

class EventExtraData extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      raw: false,
    };
  }

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.event.id !== nextProps.event.id || this.state.raw !== nextState.raw;
  }

  toggleRaw = shouldBeRaw => {
    this.setState({
      raw: shouldBeRaw,
    });
  };

  render() {
    const extraDataArray = Object.entries(this.props.event.context);
    return (
      <div className="extra-data">
        <EventDataSection
          event={this.props.event}
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
