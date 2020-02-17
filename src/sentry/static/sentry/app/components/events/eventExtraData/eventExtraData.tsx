import React from 'react';

import {Event} from 'app/types';
import {t} from 'app/locale';
import ErrorBoundary from 'app/components/errorBoundary';
import EventDataSection from 'app/components/events/eventDataSection';
import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueListV2';
import {KeyValueListData} from 'app/components/events/interfaces/keyValueList/types';
import SentryTypes from 'app/sentryTypes';
import {getMeta} from 'app/components/events/meta/metaProxy';

import EventExtraDataSubject, {EventExtraDataSubjectType} from './eventExtraDataSubject';

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

  getKeyValueListData = (): Array<KeyValueListData> | undefined => {
    const eventContext = this.props.event.context;

    if (eventContext === undefined || eventContext === null) {
      return undefined;
    }

    return Object.keys(eventContext)
      .map(key => ({
        key,
        subject: <EventExtraDataSubject type={key as EventExtraDataSubjectType} />,
        value: eventContext[key],
        meta: getMeta(eventContext, key),
      }))
      .filter(data => data.key !== null);
  };

  render() {
    return (
      <div className="extra-data">
        <EventDataSection
          type="extra"
          title={t('Additional Data')}
          toggleRaw={this.toggleRaw}
          raw={this.state.raw}
        >
          <ErrorBoundary mini>
            <KeyValueList
              data={this.getKeyValueListData()}
              raw={this.state.raw}
              isContextData
            />
          </ErrorBoundary>
        </EventDataSection>
      </div>
    );
  }
}

export default EventExtraData;
