import MD5 from 'crypto-js/md5';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import qs from 'query-string';
import styled from 'react-emotion';

import ConfigStore from 'app/stores/configStore';
import LetterAvatar from 'app/components/letterAvatar';
import Tooltip from 'app/components/tooltip';

const DEFAULT_GRAVATAR_SIZE = 64;
const ALLOWED_SIZES = [20, 32, 36, 48, 52, 64, 80, 96, 120];

class BaseAvatar extends React.Component {
  static propTypes = {
    size: PropTypes.number,
    /**
     * This is the size of the remote image to request.
     */
    remoteImageSize: PropTypes.oneOf(ALLOWED_SIZES),
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
    // No default size to ease transition from CSS defined sizes
    // size: 64,
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

  getRemoteImageSize = () => {
    let {remoteImageSize, size} = this.props;
    // Try to make sure remote image size is >= requested size
    // If requested size > allowed size then use the largest allowed size
    let allowed =
      size &&
      (ALLOWED_SIZES.find(allowedSize => allowedSize >= size) ||
        ALLOWED_SIZES[ALLOWED_SIZES.length - 1]);

    return remoteImageSize || allowed || DEFAULT_GRAVATAR_SIZE;
  };

  buildGravatarUrl = () => {
    let {gravatarId} = this.props;
    let url = ConfigStore.getConfig().gravatarBaseUrl + '/avatar/';

    url += MD5(gravatarId);

    let query = {
      s: this.getRemoteImageSize() || undefined,
      d: this.props.default || 'blank',
    };

    url += '?' + qs.stringify(query);

    return url;
  };

  buildUploadUrl = () => {
    let {uploadId} = this.props;

    return `/avatar/${uploadId}/?${qs.stringify({s: this.getRemoteImageSize()})}`;
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
        <StyledBaseAvatar
          className={classNames('avatar', this.props.className)}
          style={{
            ...sizeStyle,
            ...this.props.style,
          }}
        >
          {this.state.showBackupAvatar && this.renderLetterAvatar()}
          {this.renderImg()}
        </StyledBaseAvatar>
      </Tooltip>
    );
  }
}

export default BaseAvatar;

const StyledBaseAvatar = styled('span')`
  flex-shrink: 0;
`;
