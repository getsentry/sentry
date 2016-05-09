import React from 'react';
import $ from 'jquery';
import MD5 from 'crypto-js/md5';
import LetterAvatar from '../components/letterAvatar';

const Avatar = React.createClass({
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

  getInitialState() {
    return {
      showBackupAvatar: false,
      loadError: false
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

  buildProfileUrl() {
    let url = '/avatar/' + this.props.user.avatar.avatarUuid + '/';
    if (this.props.size) {
      url += '?' + $.param({s: this.props.size});
    }
    return url;
  },

  onLoad() {
    this.setState({showBackupAvatar: true});
  },

  onError() {
    this.setState({showBackupAvatar: true, loadError: true});
  },

  renderImg() {
    if (this.state.loadError) {
      return null;
    }
    let user = this.props.user;
    let avatarType = null;
    if (user.avatar) {
      avatarType = user.avatar.avatarType;
    } else {
      avatarType = user.email ? 'gravatar' : 'letter_avatar';
    }
    let props = {title: this.props.title, onError: this.onError, onLoad: this.onLoad};
    if (user.options && user.options.avatarType) {
      avatarType = user.options.avatarType;
    }
    if (avatarType === 'gravatar') {
      return <img src={this.buildGravatarUrl()} {...props}/>;
    } else if (avatarType === 'upload') {
      return <img src={this.buildProfileUrl()} {...props}/>;
    } else {
      return <LetterAvatar user={user}/>;
    }
  },

  render() {
    let user = this.props.user;
    if (!user) {
      return null;
    }

    return (
      <span className={this.props.className}>
        {this.state.showBackupAvatar && <LetterAvatar user={user}/>}
        {this.renderImg()}
      </span>
    );
  }
});

export default Avatar;
