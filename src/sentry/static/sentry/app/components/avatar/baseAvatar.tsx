import PropTypes from 'prop-types';
import * as React from 'react';
import classNames from 'classnames';
import * as qs from 'query-string';
import styled from '@emotion/styled';

import LetterAvatar from 'app/components/letterAvatar';
import Tooltip from 'app/components/tooltip';

import {imageStyle} from './styles';
import Gravatar from './gravatar';

const DEFAULT_GRAVATAR_SIZE = 64;
const ALLOWED_SIZES = [20, 32, 36, 48, 52, 64, 80, 96, 120];
const DEFAULT_REMOTE_SIZE = 120;

const defaultProps = {
  // No default size to ease transition from CSS defined sizes
  // size: 64,
  style: {},
  /**
   * Enable to display tooltips.
   */
  hasTooltip: false,
  /**
   * The type of avatar being rendered.
   */
  type: 'letter_avatar',
  /**
   * Path to uploaded avatar (differs based on model type)
   */
  uploadPath: 'avatar',
  /**
   * Should avatar be round instead of a square
   */
  round: false,
};

type DefaultProps = Readonly<typeof defaultProps>;

type Props = {
  size?: number;
  /**
   * This is the size of the remote image to request.
   */
  remoteImageSize?: typeof ALLOWED_SIZES[number];
  /**
   * Default gravatar to display
   */
  default?: string;
  uploadPath?: 'avatar' | 'team-avatar' | 'organization-avatar' | 'project-avatar';
  uploadId?: string | null | undefined;
  gravatarId?: string;
  letterId?: string;
  title?: string;
  /**
   * The content for the tooltip. Requires hasTooltip to display
   */
  tooltip?: React.ReactNode;
  /**
   * Additional props for the tooltip
   */
  tooltipOptions?: Tooltip['props'];

  className?: string;

  forwardedRef?: React.Ref<HTMLSpanElement>;

  style?: React.CSSProperties;
} & Partial<DefaultProps> &
  React.HTMLAttributes<HTMLSpanElement>;

type State = {
  showBackupAvatar: boolean;
  hasLoaded: boolean;
  loadError: boolean;
};

class BaseAvatar extends React.Component<Props, State> {
  static propTypes = {
    size: PropTypes.number,
    /**
     * This is the size of the remote image to request.
     */
    remoteImageSize: PropTypes.oneOf(ALLOWED_SIZES),
    /**
     * Default gravatar to display
     */
    default: PropTypes.string,
    /**
     * Enable to display tooltips.
     */
    hasTooltip: PropTypes.bool,
    /**
     * The type of avatar being rendered.
     */
    type: PropTypes.string,
    /**
     * Path to uploaded avatar (differs based on model type)
     */
    uploadPath: PropTypes.oneOf([
      'avatar',
      'team-avatar',
      'organization-avatar',
      'project-avatar',
    ]),
    uploadId: PropTypes.string,
    gravatarId: PropTypes.string,
    letterId: PropTypes.string,
    title: PropTypes.string,
    /**
     * The content for the tooltip. Requires hasTooltip to display
     */
    tooltip: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    /**
     * Additional props for the tooltip
     */
    tooltipOptions: PropTypes.object,
    /**
     * Should avatar be round instead of a square
     */
    round: PropTypes.bool,
  };

  static defaultProps = defaultProps;

  constructor(props: Props) {
    super(props);

    this.state = {
      showBackupAvatar: false,
      hasLoaded: props.type !== 'upload',
      loadError: false,
    };
  }

  getRemoteImageSize = () => {
    const {remoteImageSize, size} = this.props;
    // Try to make sure remote image size is >= requested size
    // If requested size > allowed size then use the largest allowed size
    const allowed =
      size &&
      (ALLOWED_SIZES.find(allowedSize => allowedSize >= size) ||
        ALLOWED_SIZES[ALLOWED_SIZES.length - 1]);

    return remoteImageSize || allowed || DEFAULT_GRAVATAR_SIZE;
  };

  buildUploadUrl = () => {
    const {uploadPath, uploadId} = this.props;

    return `/${uploadPath || 'avatar'}/${uploadId}/?${qs.stringify({
      s: DEFAULT_REMOTE_SIZE,
    })}`;
  };

  handleLoad = () => {
    this.setState({showBackupAvatar: false, hasLoaded: true});
  };

  handleError = () => {
    this.setState({showBackupAvatar: true, loadError: true, hasLoaded: true});
  };

  renderImg = () => {
    if (this.state.loadError) {
      return null;
    }

    const {type, round, gravatarId} = this.props;

    const eventProps = {
      onError: this.handleError,
      onLoad: this.handleLoad,
    };

    if (type === 'gravatar') {
      return (
        <Gravatar
          placeholder={this.props.default}
          gravatarId={gravatarId}
          round={round}
          remoteSize={DEFAULT_REMOTE_SIZE}
          {...eventProps}
        />
      );
    }

    if (type === 'upload') {
      return <Image round={round} src={this.buildUploadUrl()} {...eventProps} />;
    }

    return this.renderLetterAvatar();
  };

  renderLetterAvatar() {
    const {title, letterId, round} = this.props;
    return <LetterAvatar round={round} displayName={title} identifier={letterId} />;
  }

  render() {
    const {
      className,
      style,
      round,
      hasTooltip,
      size,
      tooltip,
      tooltipOptions,
      forwardedRef,
      ...props
    } = this.props;
    let sizeStyle = {};

    if (size) {
      sizeStyle = {
        width: `${size}px`,
        height: `${size}px`,
      };
    }

    return (
      <Tooltip title={tooltip} disabled={!hasTooltip} {...tooltipOptions}>
        <StyledBaseAvatar
          ref={forwardedRef}
          loaded={this.state.hasLoaded}
          className={classNames('avatar', className)}
          round={!!round}
          style={{
            ...sizeStyle,
            ...style,
          }}
          {...props}
        >
          {this.state.showBackupAvatar && this.renderLetterAvatar()}
          {this.renderImg()}
        </StyledBaseAvatar>
      </Tooltip>
    );
  }
}

export default BaseAvatar;

// Note: Avatar will not always be a child of a flex layout, but this seems like a
// sensible default.
const StyledBaseAvatar = styled('span')<{round: boolean; loaded: boolean}>`
  flex-shrink: 0;
  ${p => !p.loaded && 'background-color: rgba(200, 200, 200, 0.1);'};
  ${p => p.round && 'border-radius: 100%;'};
`;

const Image = styled('img')<Pick<Props, 'round'>>`
  ${imageStyle};
`;
