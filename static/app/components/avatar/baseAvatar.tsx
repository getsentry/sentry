import {useCallback, useState} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import * as qs from 'query-string';

import BackgroundAvatar from 'sentry/components/avatar/backgroundAvatar';
import LetterAvatar from 'sentry/components/letterAvatar';
import type {TooltipProps} from 'sentry/components/tooltip';
import {Tooltip} from 'sentry/components/tooltip';
import type {Avatar} from 'sentry/types/core';

import Gravatar from './gravatar';
import type {ImageStyleProps} from './styles';
import {imageStyle} from './styles';

type AllowedSize = 20 | 32 | 36 | 48 | 52 | 64 | 80 | 96 | 120;

const DEFAULT_REMOTE_SIZE = 120 satisfies AllowedSize;

interface BaseAvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  backupAvatar?: React.ReactNode;
  className?: string;
  forwardedRef?: React.Ref<HTMLSpanElement>;
  gravatarId?: string;
  /**
   * Enable to display tooltips.
   */
  hasTooltip?: boolean;
  letterId?: string;
  /**
   * Should avatar be round instead of a square
   */
  round?: boolean;
  size?: number;
  suggested?: boolean;
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
   * The type of avatar being rendered.
   */
  type?: Avatar['avatarType'];
  /**
   * Full URL to the uploaded avatar's image.
   */
  uploadUrl?: string | null | undefined;
}

function BaseAvatar({
  backupAvatar,
  className,
  forwardedRef,
  gravatarId,
  letterId,
  size,
  style,
  suggested,
  title,
  tooltip,
  tooltipOptions,
  uploadUrl,
  hasTooltip = false,
  round = false,
  type = 'letter_avatar',
  ...props
}: BaseAvatarProps) {
  const [hasError, setError] = useState<boolean | null>(null);

  const handleError = useCallback(() => setError(true), []);
  const handleLoad = useCallback(() => setError(false), []);

  const resolvedUploadUrl = uploadUrl
    ? `${uploadUrl}?${qs.stringify({s: DEFAULT_REMOTE_SIZE})}`
    : '';

  const letterAvatar = (
    <LetterAvatar
      round={round}
      displayName={title === '[Filtered]' ? '?' : title}
      identifier={letterId}
      suggested={suggested}
    />
  );

  const imageAvatar =
    type === 'upload' ? (
      <ImageAvatar
        src={resolvedUploadUrl}
        round={round}
        suggested={suggested}
        onLoad={handleLoad}
        onError={handleError}
      />
    ) : type === 'gravatar' ? (
      <Gravatar
        gravatarId={gravatarId}
        remoteSize={DEFAULT_REMOTE_SIZE}
        round={round}
        suggested={suggested}
        onLoad={handleLoad}
        onError={handleError}
      />
    ) : type === 'background' ? (
      <BackgroundAvatar round={round} suggested={suggested} />
    ) : (
      letterAvatar
    );

  const backup = backupAvatar ?? letterAvatar;

  const sizeStyle: React.CSSProperties = !size
    ? {}
    : {
        height: size,
        width: size,
      };

  const avatarComponent = (
    <StyledBaseAvatar
      data-test-id={`${type}-avatar`}
      ref={forwardedRef}
      className={classNames('avatar', className)}
      round={!!round}
      suggested={!!suggested}
      style={{...sizeStyle, ...style}}
      title={title}
      hasTooltip={hasTooltip}
      {...props}
    >
      {hasError ? backup : imageAvatar}
    </StyledBaseAvatar>
  );

  return hasTooltip ? (
    <Tooltip title={tooltip} {...tooltipOptions}>
      {avatarComponent}
    </Tooltip>
  ) : (
    avatarComponent
  );
}

export {BaseAvatar, type BaseAvatarProps};

// Note: Avatar will not always be a child of a flex layout, but this seems like a
// sensible default.
const StyledBaseAvatar = styled('span')<{
  hasTooltip: boolean;
  round: boolean;
  suggested: boolean;
}>`
  flex-shrink: 0;
  border-radius: ${p => (p.round ? '50%' : '3px')};
  border: ${p => (p.suggested ? `1px dashed ${p.theme.subText}` : 'none')};
  background-color: ${p => (p.suggested ? p.theme.background : 'none')};
  :hover {
    pointer-events: ${p => (p.hasTooltip ? 'none' : 'auto')};
  }
`;

const ImageAvatar = styled('img')<ImageStyleProps>`
  ${imageStyle};
`;
