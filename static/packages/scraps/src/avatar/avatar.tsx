import type React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';

import {ImageAvatar} from './imageAvatar/imageAvatar';
import {LetterAvatar} from './letterAvatar/letterAvatar';
import type {BaseAvatarStyleProps} from './avatarComponentStyles';
import {useAvatar} from './useAvatar';

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

/** Generic identity and an optional, already resolved image URL. */
export interface BaseAvatarProps extends AvatarProps {
  identifier: string;
  name: string;
  /** Optional fallback monogram, leaving the image accessible name unchanged. */
  initials?: string;
  src?: string;
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
}: BaseAvatarProps) {
  const {src, identifier, name, initials, title, round, suggested, ...restProps} =
    avatarProps;
  const avatarDefinition = useAvatar({identifier, name, initials, src});

  return (
    <Tooltip title={tooltip} disabled={!hasTooltip} {...tooltipOptions} skipWrapper>
      <AvatarContainer
        ref={ref}
        data-test-id={testId ?? (src ? 'image-avatar' : 'letter-avatar')}
        className={classNames('avatar', className)}
        round={round}
        suggested={!!suggested}
        style={{...(size ? {height: size, width: size} : {}), ...style}}
        title={title}
        {...restProps}
      >
        {avatarDefinition.type === 'image' ? (
          <ImageAvatar
            loading="eager"
            configuration={avatarDefinition.configuration}
            round={round}
            suggested={suggested}
          />
        ) : (
          <LetterAvatar
            configuration={avatarDefinition.configuration}
            round={round}
            suggested={suggested}
          />
        )}
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
