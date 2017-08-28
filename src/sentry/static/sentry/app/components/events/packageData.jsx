import React from 'react';
import SentryTypes from '../../proptypes';

import {objectToArray} from '../../utils';
import EventDataSection from './eventDataSection';
import ClippedBox from '../clippedBox';
import KeyValueList from './interfaces/keyValueList';
import {t} from '../../locale';

const EventPackageData = React.createClass({
  propTypes: {
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired
  },

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.event.id !== nextProps.event.id;
  },

  render() {
    let packages = objectToArray(this.props.event.packages);

    return (
      <EventDataSection
        group={this.props.group}
        event={this.props.event}
        type="packages"
        title={t('Packages')}>
        <ClippedBox>
          <KeyValueList data={packages} />
        </ClippedBox>
      </EventDataSection>
    );
  }
});

export default EventPackageData;
