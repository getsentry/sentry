import _ from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import KeyValueList from 'app/components/events/interfaces/keyValueList';
import {t} from 'app/locale';

const keyMapping = {
  image_uuid: 'Debug ID',
  image_name: 'File Name',
  image_path: 'File Path',
};

class EventErrorItem extends React.Component {
  static propTypes = {
    error: PropTypes.object.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      isOpen: false,
    };
  }

  shouldComponentUpdate(nextProps, nextState) {
    return this.state.isOpen !== nextState.isOpen;
  }

  toggle = () => {
    this.setState({isOpen: !this.state.isOpen});
  };

  cleanedData() {
    let data = {...this.props.error.data};

    if (data.message === 'None') {
      // Python ensures a message string, but "None" doesn't make sense here
      delete data.message;
    }

    if (typeof data.image_path === 'string') {
      // Separate the image name for readability
      let separator = /^[a-z]:\\/i.test(data.image_path) ? '\\' : '/';
      let path = data.image_path.split(separator);
      data.image_name = path.splice(-1, 1)[0];
      data.image_path = path.length ? path.join(separator) + separator : '';
    }

    return _.mapKeys(data, (value, key) => t(keyMapping[key] || _.startCase(key)));
  }

  render() {
    let error = this.props.error;
    let isOpen = this.state.isOpen;
    let data = this.cleanedData();
    return (
      <li>
        {error.message}
        {!_.isEmpty(data) && (
          <small>
            {' '}
            <a style={{marginLeft: 10}} onClick={this.toggle}>
              {isOpen ? t('Collapse') : t('Expand')}
            </a>
          </small>
        )}
        {isOpen && <KeyValueList data={data} isContextData />}
      </li>
    );
  }
}

export default EventErrorItem;
