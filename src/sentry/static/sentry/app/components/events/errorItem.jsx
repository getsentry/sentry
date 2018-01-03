import PropTypes from 'prop-types';
import React from 'react';
import {t} from '../../locale';

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

  render() {
    let error = this.props.error;
    let isOpen = this.state.isOpen;
    return (
      <li>
        {error.message}
        <small>
          {' '}
          <a style={{marginLeft: 10}} onClick={this.toggle}>
            {isOpen ? t('Collapse') : t('Expand')}
          </a>
        </small>
        <pre style={{display: isOpen ? 'block' : 'none'}}>
          {JSON.stringify(error.data, null, 2)}
        </pre>
      </li>
    );
  }
}

export default EventErrorItem;
