import React from 'react';

import {t} from 'app/locale';
import ClippedBox from 'app/components/clippedBox';
import ErrorBoundary from 'app/components/errorBoundary';
import EventDataSection from 'app/components/events/eventDataSection';
import KeyValueList from 'app/components/events/interfaces/keyValueList';
import SentryTypes from 'app/sentryTypes';

class EventPackageData extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
  };

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.event.id !== nextProps.event.id;
  }

  render() {
    const packages = Object.entries(this.props.event.packages);

    return (
      <EventDataSection event={this.props.event} type="packages" title={t('Packages')}>
        <ClippedBox>
          <ErrorBoundary mini>
            <KeyValueList data={packages} />
          </ErrorBoundary>
        </ClippedBox>
      </EventDataSection>
    );
  }
}

export default EventPackageData;
