import MD5 from 'crypto-js/md5';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import qs from 'query-string';

import ConfigStore from '../../stores/configStore';
import LetterAvatar from '../letterAvatar';
import Tooltip from '../tooltip';

class BaseAvatar extends React.Component {
  static propTypes = {
    size: PropTypes.number,
    default: PropTypes.string,
    hasTooltip: PropTypes.bool,
    type: PropTypes.string,
    uploadId: PropTypes.string,
    gravatarId: PropTypes.string,
    letterId: PropTypes.string,
    title: PropTypes.string,
    tooltip: PropTypes.string,
  };

  static defaultProps = {
    size: 64,
    style: {},
    hasTooltip: false,
    type: 'letter_avatar',
  };

  constructor(...args) {
    super(...args);
    this.state = {
      showBackupAvatar: false,
      loadError: false,
    };
  }

  buildGravatarUrl = () => {
    let {gravatarId} = this.props;
    let url = ConfigStore.getConfig().gravatarBaseUrl + '/avatar/';

    url += MD5(gravatarId);

    let query = {
      s: this.props.size || undefined,
      d: this.props.default || 'blank',
    };

    url += '?' + qs.stringify(query);

    return url;
  };

  buildUploadUrl = () => {
    let {uploadId, size} = this.props;

    let url = `/avatar/${uploadId}/`;

    if (size) {
      url += '?' + qs.stringify({s: size});
    }

    return url;
  };

  handleLoad = () => {
    this.setState({showBackupAvatar: true});
  };

  handleError = () => {
    this.setState({showBackupAvatar: true, loadError: true});
  };

  renderImg = () => {
    if (this.state.loadError) {
      return null;
    }

    let {type} = this.props;

    let props = {
      onError: this.handleError,
      onLoad: this.handleLoad,
    };
    if (type === 'gravatar') {
      return <img src={this.buildGravatarUrl()} {...props} />;
    }

    if (type === 'upload') {
      return <img src={this.buildUploadUrl()} {...props} />;
    }

    return this.renderLetterAvatar();
  };

  renderLetterAvatar() {
    let {title, letterId} = this.props;
    return <LetterAvatar displayName={title} identifier={letterId} />;
  }

  render() {
    let {hasTooltip, size, tooltip} = this.props;
    let sizeStyle = {};

    if (size) {
      sizeStyle = {
        width: `${size}px`,
        height: `${size}px`,
      };
    }

    return (
      <Tooltip title={tooltip} disabled={!hasTooltip}>
        <span
          className={classNames('avatar', this.props.className)}
          style={{
            ...sizeStyle,
            ...this.props.style,
          }}
        >
          {this.state.showBackupAvatar && this.renderLetterAvatar()}
          {this.renderImg()}
        </span>
      </Tooltip>
    );
  }
}

export default BaseAvatar;
