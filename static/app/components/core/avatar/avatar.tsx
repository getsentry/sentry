import type React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';

import {Gravatar} from './gravatar/gravatar';
import {ImageAvatar} from './imageAvatar/imageAvatar';
import {LetterAvatar} from './letterAvatar/letterAvatar';
import type {BaseAvatarStyleProps} from './avatarComponentStyles';

const DEFAULT_REMOTE_SIZE = 120;

export interface AvatarProps extends BaseAvatarStyleProps {
  className?: string;
  'data-test-id'?: string;
  hasTooltip?: boolean;
  ref?: React.Ref<HTMLSpanElement>;
  style?: React.CSSProperties;
  title?: string;
  tooltip?: React.ReactNode;
  tooltipOptions?: Omit<TooltipProps, 'children' | 'title'>;
}

export interface GravatarBaseAvatarProps extends AvatarProps {
  gravatarId: string;
  identifier: string;
  name: string;
  type: 'gravatar';
}

export interface LetterBaseAvatarProps extends AvatarProps {
  identifier: string;
  name: string;
  type: 'letter_avatar';
}

export interface UploadBaseAvatarProps extends AvatarProps {
  identifier: string;
  name: string;
  type: 'upload';
  uploadUrl: string;
}

export function Avatar({
  ref,
  className,
  size,
  style,
  tooltip,
  tooltipOptions,
  hasTooltip = false,
  'data-test-id': testId,
  ...avatarProps
}: GravatarBaseAvatarProps | LetterBaseAvatarProps | UploadBaseAvatarProps) {
  // Destructure avatar-specific props to prevent spreading onto DOM
  const {type, identifier, name, title, round, suggested, ...restProps} = avatarProps;

  return (
    <Tooltip title={tooltip} disabled={!hasTooltip} {...tooltipOptions} skipWrapper>
      <AvatarContainer
        ref={ref as React.Ref<HTMLSpanElement>}
        data-test-id={testId ?? `${type}-avatar`}
        className={classNames('avatar', className)}
        round={round}
        suggested={!!suggested}
        style={{...(size ? {height: size, width: size} : {}), ...style}}
        title={title}
        {...restProps}
      >
        {type === 'upload' ? (
          <ImageAvatar
            src={buildUploadUrl((avatarProps as UploadBaseAvatarProps).uploadUrl)}
            identifier={identifier}
            name={name}
            round={round}
            suggested={suggested}
          />
        ) : type === 'gravatar' ? (
          <Gravatar
            gravatarId={(avatarProps as GravatarBaseAvatarProps).gravatarId}
            name={name}
            round={round}
            suggested={suggested}
          />
        ) : type === 'letter_avatar' ? (
          <LetterAvatar
            identifier={identifier}
            name={name}
            round={round}
            suggested={suggested}
          />
        ) : null}
      </AvatarContainer>
    </Tooltip>
  );
}

/**
 * Appends size parameter to uploaded avatar URLs for optimization.
 * Skips data URLs which are already base64 encoded.
 */
function buildUploadUrl(url: string): string {
  if (url.startsWith('data:')) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}s=${DEFAULT_REMOTE_SIZE}`;
}

// Note: Avatar will not always be a child of a flex layout, but this seems like a
// sensible default.
const AvatarContainer = styled('span')<BaseAvatarStyleProps>`
  flex-shrink: 0;
  border-radius: ${p => (p.round ? '50%' : '3px')};
  border: ${p =>
    p.suggested ? `1px dashed ${p.theme.tokens.border.neutral.vibrant}` : 'none'};
  background-color: ${p => (p.suggested ? p.theme.tokens.background.primary : 'none')};
`;
