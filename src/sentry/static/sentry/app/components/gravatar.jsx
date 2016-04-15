import React from 'react';
import $ from 'jquery';
import MD5 from 'crypto-js/md5';
import LetterAvatar from '../components/letterAvatar';

const Gravatar = React.createClass({
  propTypes: {
    user: React.PropTypes.object,
    size: React.PropTypes.number,
    default: React.PropTypes.string,
    title: React.PropTypes.string
  },

  getDefaultProps() {
    return {
      className: 'avatar',
      size: 64
    };
  },

  buildGravatarUrl() {
    let url = 'https://secure.gravatar.com/avatar/';

    url += MD5(this.props.user.email.toLowerCase());

    let query = {
      s: this.props.size || undefined,
      d: this.props.default || 'blank'
    };

    url += '?' + $.param(query);

    return url;
  },

  render() {
    let user = this.props.user;
    if (!user) {
      return null;
    }

    return (
      <span className={this.props.className}>
        <LetterAvatar user={user}/>
        {user.email && <img src={this.buildGravatarUrl()} title={this.props.title}/>}
      </span>
    );
  }
});

export default Gravatar;
