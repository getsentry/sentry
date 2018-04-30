import React from 'react';

import {objectToArray} from 'app/utils';
import {t} from 'app/locale';
import ClippedBox from 'app/components/clippedBox';
import ErrorBoundary from 'app/components/errorBoundary';
import EventDataSection from 'app/components/events/eventDataSection';
import KeyValueList from 'app/components/events/interfaces/keyValueList';
import SentryTypes from 'app/proptypes';

class EventPackageData extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired,
  };

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.event.id !== nextProps.event.id;
  }

  render() {
    let packages = objectToArray(this.props.event.packages);

    return (
      <EventDataSection
        group={this.props.group}
        event={this.props.event}
        type="packages"
        title={t('Packages')}
      >
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
