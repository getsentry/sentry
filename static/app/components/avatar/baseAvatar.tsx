import * as React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import * as qs from 'query-string';

import BackgroundAvatar from 'app/components/avatar/backgroundAvatar';
import LetterAvatar from 'app/components/letterAvatar';
import Tooltip from 'app/components/tooltip';
import {Avatar} from 'app/types';

import Gravatar from './gravatar';
import {imageStyle, ImageStyleProps} from './styles';

const DEFAULT_GRAVATAR_SIZE = 64;
const ALLOWED_SIZES = [20, 32, 36, 48, 52, 64, 80, 96, 120];
const DEFAULT_REMOTE_SIZE = 120;

// Note: Avatar will not always be a child of a flex layout, but this seems like a
// sensible default.
const StyledBaseAvatar = styled('span')<{
  round: boolean;
  loaded: boolean;
  suggested: boolean;
}>`
  flex-shrink: 0;
  border-radius: ${p => (p.round ? '50%' : '3px')};
  border: ${p => (p.suggested ? `1px dashed ${p.theme.gray400}` : 'none')};
  background-color: ${p =>
    p.loaded ? p.theme.background : 'background-color: rgba(200, 200, 200, 0.1);'};
`;

const defaultProps: DefaultProps = {
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

type DefaultProps = {
  style?: React.CSSProperties;
  suggested?: boolean;
  /**
   * Enable to display tooltips.
   */
  hasTooltip?: boolean;
  /**
   * The type of avatar being rendered.
   */
  type?: Avatar['avatarType'];
  /**
   * Should avatar be round instead of a square
   */
  round?: boolean;
  /**
   * Path to uploaded avatar (differs based on model type)
   */
  uploadPath?: 'avatar' | 'team-avatar' | 'organization-avatar' | 'project-avatar';
};

type BaseProps = DefaultProps & {
  size?: number;
  /**
   * This is the size of the remote image to request.
   */
  remoteImageSize?: typeof ALLOWED_SIZES[number];
  /**
   * Default gravatar to display
   */
  default?: string;
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
  tooltipOptions?: Omit<Tooltip['props'], 'children' | 'title'>;
  className?: string;
  forwardedRef?: React.Ref<HTMLSpanElement>;
};

type Props = BaseProps;

type State = {
  showBackupAvatar: boolean;
  hasLoaded: boolean;
  loadError: boolean;
};

class BaseAvatar extends React.Component<Props, State> {
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

    const {type, round, gravatarId, suggested} = this.props;

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
          suggested={suggested}
          grayscale={suggested}
          {...eventProps}
        />
      );
    }

    if (type === 'upload') {
      return (
        <Image
          round={round}
          src={this.buildUploadUrl()}
          {...eventProps}
          suggested={suggested}
          grayscale={suggested}
        />
      );
    }

    if (type === 'background') {
      return this.renderBackgroundAvatar();
    }

    return this.renderLetterAvatar();
  };

  renderLetterAvatar() {
    const {title, letterId, round, suggested} = this.props;
    return (
      <LetterAvatar
        round={round}
        displayName={title}
        identifier={letterId}
        suggested={suggested}
      />
    );
  }

  renderBackgroundAvatar() {
    const {round, suggested} = this.props;
    return <BackgroundAvatar round={round} suggested={suggested} />;
  }

  render() {
    const {
      className,
      style,
      round,
      hasTooltip,
      size,
      suggested,
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
          suggested={!!suggested}
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

const Image = styled('img')<ImageStyleProps>`
  ${imageStyle};
`;
