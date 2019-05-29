import PropTypes from 'prop-types';
import React from 'react';
import SentryTypes from 'app/sentryTypes';
import EventDataSection from 'app/components/events/eventDataSection';
import ClippedBox from 'app/components/clippedBox';
import KeyValueList from 'app/components/events/interfaces/keyValueList';
import {t} from 'app/locale';

class DebugMetaInterface extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    data: PropTypes.object.isRequired,
  };

  getImageDetail(img) {
    // in particular proguard images do not have a code file, skip them
    if (img === null || img.code_file === null || img.type === 'proguard') {
      return null;
    }

    const directorySeparator = /^([a-z]:\\|\\\\)/i.test(img.code_file) ? '\\' : '/';
    const code_file = img.code_file.split(directorySeparator).pop();
    if (code_file === 'dyld_sim') {
      // this is only for simulator builds
      return null;
    }

    const version = img.debug_id || '<none>';
    return [code_file, version];
  }

  render() {
    const data = this.props.data;

    // skip null values indicating invalid debug images
    const images = data.images.map(img => this.getImageDetail(img)).filter(img => img);
    if (images.length === 0) {
      return null;
    }

    return (
      <div>
        <EventDataSection
          event={this.props.event}
          type="packages"
          title={t('Images Loaded')}
        >
          <ClippedBox>
            <KeyValueList data={images} isSorted={false} />
          </ClippedBox>
        </EventDataSection>
      </div>
    );
  }
}

export default DebugMetaInterface;
