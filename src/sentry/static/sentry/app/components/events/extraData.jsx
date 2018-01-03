import React from 'react';

import SentryTypes from '../../proptypes';
import {objectToArray} from '../../utils';
import EventDataSection from './eventDataSection';
import KeyValueList from './interfaces/keyValueList';
import {t} from '../../locale';

class EventExtraData extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
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
    let extraDataArray = objectToArray(this.props.event.context);
    return (
      <div className="extra-data">
        <EventDataSection
          group={this.props.group}
          event={this.props.event}
          type="extra"
          title={t('Additional Data')}
          toggleRaw={this.toggleRaw}
          raw={this.state.raw}
        >
          <KeyValueList data={extraDataArray} isContextData={true} raw={this.state.raw} />
        </EventDataSection>
      </div>
    );
  }
}

export default EventExtraData;
