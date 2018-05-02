import React from 'react';
import PropTypes from 'prop-types';

import MultiSelectControl from 'app/components/forms/multiSelectControl';
import ActorAvatar from 'app/components/actorAvatar';

import {t} from 'app/locale';

class ValueComponent extends React.Component {
  static propTypes = {
    value: PropTypes.object,
    onRemove: PropTypes.func,
  };

  handleClick = () => {
    this.props.onRemove(this.props.value);
  };

  render() {
    return (
      <a onClick={this.handleClick}>
        <ActorAvatar actor={this.props.value.actor} size={28} />
      </a>
    );
  }
}

export default class SelectOwners extends React.Component {
  static propTypes = {
    options: PropTypes.array.isRequired,
    value: PropTypes.array,
    onChange: PropTypes.func,
  };

  render() {
    return (
      <MultiSelectControl
        options={this.props.options}
        style={{width: 200, overflow: 'visible'}}
        valueComponent={ValueComponent}
        placeholder={t('Add Owners')}
        onChange={this.props.onChange}
        value={this.props.value}
      />
    );
  }
}
