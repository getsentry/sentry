import type React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';

import {Gravatar} from './gravatar/gravatar';
import {ImageAvatar} from './imageAvatar/imageAvatar';
import {LetterAvatar} from './letterAvatar/letterAvatar';
import type {BaseAvatarStyleProps} from './avatarComponentStyles';

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
  ...props
}: GravatarBaseAvatarProps | LetterBaseAvatarProps | UploadBaseAvatarProps) {
  return (
    <Tooltip title={tooltip} disabled={!hasTooltip} {...tooltipOptions} skipWrapper>
      <AvatarContainer
        ref={ref as React.Ref<HTMLSpanElement>}
        data-test-id={testId ?? `${props.type}-avatar`}
        className={classNames('avatar', className)}
        suggested={!!props.suggested}
        style={{...(size ? {height: size, width: size} : {}), ...style}}
        {...props}
      >
        {props.type === 'upload' ? (
          <ImageAvatar src={props.uploadUrl} {...props} />
        ) : props.type === 'gravatar' ? (
          <Gravatar {...props} />
        ) : props.type === 'letter_avatar' ? (
          <LetterAvatar {...(props as LetterBaseAvatarProps)} />
        ) : null}
      </AvatarContainer>
    </Tooltip>
  );
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
