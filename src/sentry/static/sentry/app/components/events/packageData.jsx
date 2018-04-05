import React from 'react';

import {objectToArray} from '../../utils';
import {t} from '../../locale';
import ClippedBox from '../clippedBox';
import ErrorBoundary from '../errorBoundary';
import EventDataSection from './eventDataSection';
import KeyValueList from './interfaces/keyValueList';
import SentryTypes from '../../proptypes';

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
