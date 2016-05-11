import React from 'react';

import {t} from '../locale';


const AvatarRadio = React.createClass({
  propTypes: {
    user: React.PropTypes.object.isRequired,
    updateUser: React.PropTypes.func.isRequired
  },

  OPTIONS: {
    upload: 'Upload a Photo',
    gravatar: 'Use Gravatar',
    letter_avatar: 'Use my initials'
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
            <input type="radio" name="avatar-type" value={opt} onChange={this.onChange}
                   checked={this.props.user.avatar.avatarType === opt}/>
            {this.OPTIONS[opt]}
          </label>
        </li>
      );
    }
    return (
      <div>
        <legend>{t('Avatar Type')}</legend>
        <ul className="radio-inputs">
          {radios}
        </ul>
      </div>
    );
  }
});

export default AvatarRadio;
