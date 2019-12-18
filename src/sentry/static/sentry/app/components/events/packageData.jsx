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

  shouldComponentUpdate(nextProps) {
    return this.props.event.id !== nextProps.event.id;
  }

  render() {
    let longKeys, title;
    const {event} = this.props;
    const packages = Object.entries(event.packages);

    switch (event.platform) {
      case 'csharp':
        longKeys = true;
        title = t('Assemblies');
        break;
      default:
        longKeys = false;
        title = t('Packages');
    }

    return (
      <EventDataSection event={event} type="packages" title={title}>
        <ClippedBox>
          <ErrorBoundary mini>
            <KeyValueList data={packages} longKeys={longKeys} />
          </ErrorBoundary>
        </ClippedBox>
      </EventDataSection>
    );
  }
}

export default EventPackageData;
