import {Component} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import * as qs from 'query-string';

import BackgroundAvatar from 'sentry/components/avatar/backgroundAvatar';
import LetterAvatar from 'sentry/components/letterAvatar';
import {Tooltip, TooltipProps} from 'sentry/components/tooltip';
import {Avatar} from 'sentry/types';

import Gravatar from './gravatar';
import {imageStyle, ImageStyleProps} from './styles';

const DEFAULT_GRAVATAR_SIZE = 64;
const ALLOWED_SIZES = [20, 32, 36, 48, 52, 64, 80, 96, 120];
const DEFAULT_REMOTE_SIZE = 120;

// Note: Avatar will not always be a child of a flex layout, but this seems like a
// sensible default.
const StyledBaseAvatar = styled('span')<{
  loaded: boolean;
  round: boolean;
  suggested: boolean;
}>`
  flex-shrink: 0;
  border-radius: ${p => (p.round ? '50%' : '3px')};
  border: ${p => (p.suggested ? `1px dashed ${p.theme.subText}` : 'none')};
  background-color: ${p => (p.suggested ? p.theme.background : 'none')};
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
   * Should avatar be round instead of a square
   */
  round: false,
};

type DefaultProps = {
  /**
   * Enable to display tooltips.
   */
  hasTooltip?: boolean;
  /**
   * Should avatar be round instead of a square
   */
  round?: boolean;
  style?: React.CSSProperties;
  suggested?: boolean;
  /**
   * The type of avatar being rendered.
   */
  type?: Avatar['avatarType'];
};

type BaseProps = DefaultProps & {
  backupAvatar?: React.ReactNode;
  className?: string;
  /**
   * Default gravatar to display
   */
  default?: string;
  forwardedRef?: React.Ref<HTMLSpanElement>;
  gravatarId?: string;
  letterId?: string;
  /**
   * This is the size of the remote image to request.
   */
  remoteImageSize?: (typeof ALLOWED_SIZES)[number];
  size?: number;
  title?: string;
  /**
   * The content for the tooltip. Requires hasTooltip to display
   */
  tooltip?: React.ReactNode;
  /**
   * Additional props for the tooltip
   */
  tooltipOptions?: Omit<TooltipProps, 'children' | 'title'>;
  /**
   * Full URL to the uploaded avatar's image.
   */
  uploadUrl?: string | null | undefined;
};

type Props = BaseProps;

type State = {
  hasLoaded: boolean;
  loadError: boolean;
  showBackupAvatar: boolean;
};

class BaseAvatar extends Component<Props, State> {
  static defaultProps = defaultProps;

  constructor(props: Props) {
    super(props);

    this.state = {
      showBackupAvatar: false,
      hasLoaded: props.type !== 'upload',
      loadError: false,
    };
  }

  getRemoteImageSize() {
    const {remoteImageSize, size} = this.props;
    // Try to make sure remote image size is >= requested size
    // If requested size > allowed size then use the largest allowed size
    const allowed =
      size &&
      (ALLOWED_SIZES.find(allowedSize => allowedSize >= size) ||
        ALLOWED_SIZES[ALLOWED_SIZES.length - 1]);

    return remoteImageSize || allowed || DEFAULT_GRAVATAR_SIZE;
  }

  buildUploadUrl() {
    const {uploadUrl} = this.props;
    if (!uploadUrl) {
      return '';
    }

    return `${uploadUrl}?${qs.stringify({s: DEFAULT_REMOTE_SIZE})}`;
  }

  handleLoad = () => {
    this.setState({showBackupAvatar: false, hasLoaded: true});
  };

  handleError = () => {
    this.setState({showBackupAvatar: true, loadError: true, hasLoaded: true});
  };

  renderImg() {
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
        />
      );
    }

    if (type === 'background') {
      return this.renderBackgroundAvatar();
    }

    return this.renderLetterAvatar();
  }

  renderLetterAvatar() {
    const {title, letterId, round, suggested} = this.props;
    const modifiedTitle = title === '[Filtered]' ? '?' : title;

    return (
      <LetterAvatar
        round={round}
        displayName={modifiedTitle}
        identifier={letterId}
        suggested={suggested}
      />
    );
  }

  renderBackgroundAvatar() {
    const {round, suggested} = this.props;
    return <BackgroundAvatar round={round} suggested={suggested} />;
  }

  renderBackupAvatar() {
    const {backupAvatar} = this.props;
    return backupAvatar ?? this.renderLetterAvatar();
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
      type,
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
          data-test-id={`${type}-avatar`}
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
          {this.state.showBackupAvatar && this.renderBackupAvatar()}
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
