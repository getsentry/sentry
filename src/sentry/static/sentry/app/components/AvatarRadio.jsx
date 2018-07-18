import PropTypes from 'prop-types';
import React from 'react';

import createReactClass from 'create-react-class';

import {t} from 'app/locale';

const AvatarRadio = createReactClass({
  displayName: 'AvatarRadio',

  propTypes: {
    user: PropTypes.object.isRequired,
    updateUser: PropTypes.func.isRequired,
  },

  OPTIONS: {
    upload: 'Upload a Photo',
    gravatar: 'Use Gravatar',
    letter_avatar: 'Use my initials',
  },

  onChange(ev) {
    let avatar = Object.assign({}, this.props.user.avatar, {avatarType: ev.target.value});
    this.props.user.avatar = avatar;
    this.props.updateUser(this.props.user);
  },

  render() {
    let radios = [];
    for (let opt in this.OPTIONS) {
      radios.push(
        <li className="radio" key={opt}>
          <label>
            <input
              type="radio"
              name="avatar-type"
              value={opt}
              onChange={this.onChange}
              checked={this.props.user.avatar.avatarType === opt}
            />
            {this.OPTIONS[opt]}
          </label>
        </li>
      );
    }
    return (
      <div>
        <legend>{t('Avatar Type')}</legend>
        <ul className="radio-inputs">{radios}</ul>
      </div>
    );
  },
});

export default AvatarRadio;
