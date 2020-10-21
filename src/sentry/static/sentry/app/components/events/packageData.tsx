import { Component } from 'react';

import {Event} from 'app/types';
import {t} from 'app/locale';
import ClippedBox from 'app/components/clippedBox';
import ErrorBoundary from 'app/components/errorBoundary';
import EventDataSection from 'app/components/events/eventDataSection';
import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueList';
import SentryTypes from 'app/sentryTypes';

type Props = {
  event: Event;
};

class EventPackageData extends Component<Props> {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
  };

  shouldComponentUpdate(nextProps: Props) {
    return this.props.event.id !== nextProps.event.id;
  }

  render() {
    const {event} = this.props;
    let longKeys: boolean, title: string;
    const packages = Object.entries(event.packages || {});

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
      <EventDataSection type="packages" title={title}>
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
