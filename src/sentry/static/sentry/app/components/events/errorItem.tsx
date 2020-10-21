import mapKeys from 'lodash/mapKeys';
import moment from 'moment';
import startCase from 'lodash/startCase';
import isEmpty from 'lodash/isEmpty';
import { Component, Fragment } from 'react';

import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueList';
import {t} from 'app/locale';
import {EventError} from 'app/sentryTypes';

type Error = {
  type: string;
  message: string;
  data: {
    name?: string;
    message?: string;
    image_path?: string;
    image_name?: string;
    server_time?: string;
    sdk_time?: string;
  };
};

const keyMapping = {
  image_uuid: 'Debug ID',
  image_name: 'File Name',
  image_path: 'File Path',
};

type Props = {
  error: Error;
};

type State = {
  isOpen: boolean;
};

class EventErrorItem extends Component<Props, State> {
  static propTypes = {
    error: EventError.isRequired,
  };

  state: State = {
    isOpen: false,
  };

  shouldComponentUpdate(_nextProps, nextState) {
    return this.state.isOpen !== nextState.isOpen;
  }

  toggle = () => {
    this.setState({isOpen: !this.state.isOpen});
  };

  cleanedData() {
    const data = {...this.props.error.data};

    // The name is rendered as path in front of the message
    if (typeof data.name === 'string') {
      delete data.name;
    }

    if (data.message === 'None') {
      // Python ensures a message string, but "None" doesn't make sense here
      delete data.message;
    }

    if (typeof data.image_path === 'string') {
      // Separate the image name for readability
      const separator = /^([a-z]:\\|\\\\)/i.test(data.image_path) ? '\\' : '/';
      const path = data.image_path.split(separator);
      data.image_name = path.splice(-1, 1)[0];
      data.image_path = path.length ? path.join(separator) + separator : '';
    }

    if (typeof data.server_time === 'string' && typeof data.sdk_time === 'string') {
      data.message = t(
        'Adjusted timestamps by %s',
        moment
          .duration(moment.utc(data.server_time).diff(moment.utc(data.sdk_time)))
          .humanize()
      );
    }

    return mapKeys(data, (_value, key) => t(keyMapping[key] || startCase(key)));
  }

  renderPath() {
    const {name} = this.props.error.data || {};

    if (!name || typeof name !== 'string') {
      return null;
    }

    return (
      <Fragment>
        <strong>{name}</strong>
        {': '}
      </Fragment>
    );
  }

  render() {
    const error = this.props.error;
    const isOpen = this.state.isOpen;
    const data = this.cleanedData();
    return (
      <li>
        {this.renderPath()}
        {error.message}
        {!isEmpty(data) && (
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
