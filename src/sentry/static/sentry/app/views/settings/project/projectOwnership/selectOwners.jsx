import React from 'react';
import PropTypes from 'prop-types';

import MultiSelectField from '../../../../components/forms/multiSelectField';
import ActorAvatar from '../../../../components/actorAvatar';

import {t} from '../../../../locale';

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
      <MultiSelectField
        options={this.props.options}
        multi={true}
        style={{width: 200}}
        valueComponent={ValueComponent}
        placeholder={t('Add Owners')}
        onChange={this.props.onChange}
        value={this.props.value}
      />
    );
  }
}
