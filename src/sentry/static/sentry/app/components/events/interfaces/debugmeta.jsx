import React from 'react';
import PropTypes from '../../../proptypes';
import EventDataSection from '../eventDataSection';
import ClippedBox from '../../clippedBox';
import KeyValueList from './keyValueList';
import {t} from '../../../locale';

const DebugMetaInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    data: React.PropTypes.object.isRequired
  },

  render() {
    let data = this.props.data;

    // TODO(hazat): don't use image.uuid should be version number
    // as soon as this is implemented in KSCrash
    let images = data.images.map(
        (image) => [image.name.split('/').pop(), image.uuid]
    );

    return (
      <div>
        <EventDataSection
            group={this.props.group}
            event={this.props.event}
            type="packages"
            title={t('Images Loaded')}>
            <ClippedBox>
                <KeyValueList data={images} isSorted={false} />
            </ClippedBox>
        </EventDataSection>
      </div>
    );
  }
});

export default DebugMetaInterface;
