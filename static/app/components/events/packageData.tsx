import {Component} from 'react';

import ClippedBox from 'app/components/clippedBox';
import ErrorBoundary from 'app/components/errorBoundary';
import EventDataSection from 'app/components/events/eventDataSection';
import KeyValueList from 'app/components/events/interfaces/keyValueList';
import {getMeta} from 'app/components/events/meta/metaProxy';
import {t} from 'app/locale';
import {Event} from 'app/types/event';

type Props = {
  event: Event;
};

class EventPackageData extends Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    return this.props.event.id !== nextProps.event.id;
  }

  render() {
    const {event} = this.props;
    let longKeys: boolean, title: string;
    const packages = Object.entries(event.packages || {}).map(([key, value]) => ({
      key,
      value,
      subject: key,
      meta: getMeta(event.packages, key),
    }));

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
