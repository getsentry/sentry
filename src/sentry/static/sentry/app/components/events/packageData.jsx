import React from 'react';
import PropTypes from '../../proptypes';

import {objectToArray} from '../../utils';
import EventDataSection from './eventDataSection';
import ClippedBox from '../clippedBox';
import KeyValueList from './interfaces/keyValueList';
import {t} from '../../locale';

const EventPackageData = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired
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
