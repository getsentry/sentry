import PropTypes from 'prop-types';
import React from 'react';
import SentryTypes from 'app/proptypes';
import EventDataSection from 'app/components/events/eventDataSection';
import ClippedBox from 'app/components/clippedBox';
import KeyValueList from 'app/components/events/interfaces/keyValueList';
import {t} from 'app/locale';

class DebugMetaInterface extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired,
    data: PropTypes.object.isRequired,
  };

  getImageDetail(img, evt) {
    // in particular proguard images do not have a name, skip them
    if (img.name === null || img.type === 'proguard') {
      return null;
    }

    let name = img.name.split(/^[a-z]:\\/i.test(img.name) ? '\\' : '/').pop();
    if (name == 'dyld_sim') return null; // this is only for simulator builds

    let version = null;
    if (
      Number.isInteger(img.major_version) &&
      Number.isInteger(img.minor_version) &&
      Number.isInteger(img.revision_version)
    ) {
      if (img.major_version == 0 && img.minor_version == 0 && img.revision_version == 0) {
        // we show the version
        version = (evt.release && evt.release.shortVersion) || 'unknown';
      } else
        version = `${img.major_version}.${img.minor_version}.${img.revision_version}`;
    } else version = img.id || img.uuid || '<none>';

    if (version) return [name, version];

    return null;
  }

  render() {
    let data = this.props.data;
    let images = data.images
      .map(img => this.getImageDetail(img, this.props.event))
      .filter(img => img); // removes null values

    let result = null;

    if (images.length > 0) {
      result = (
        <div>
          <EventDataSection
            group={this.props.group}
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

    return result;
  }
}

export default DebugMetaInterface;
