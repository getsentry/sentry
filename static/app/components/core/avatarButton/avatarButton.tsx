import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import color from 'color';

import type {BaseAvatarProps} from '@sentry/scraps/avatar';
import {ImageAvatar, LetterAvatar, useAvatar} from '@sentry/scraps/avatar';
import {Button, type ButtonProps} from '@sentry/scraps/button';

interface AvatarButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'priority'> {
  'aria-label': string;
  avatar: BaseAvatarProps;
  size?: Exclude<ButtonProps['size'], 'zero'>;
}

interface AvatarColors {
  chonk: string;
  surface: string;
}

/**
 * Minimum contrast ratio between the avatar color and the page background.
 * Below this threshold the default button colors are used instead, preventing
 * near-invisible buttons when e.g. a white logo is uploaded.
 */
const MIN_CONTRAST_RATIO = 1.3;

/**
 * Darkens a color for use as the chonk (shadow/base) layer of the button.
 */
function darkenAvatarColor(c: string): string {
  return color(c).darken(0.35).hex();
}

/**
 * Derives button surface and chonk colors from an avatar definition.
 * Returns undefined when the avatar color has insufficient contrast with the
 * page background, so the button falls back to its default neutral styling.
 */
function getAvatarColors(
  avatarDefinition: ReturnType<typeof useAvatar>,
  pageBackground: string
): AvatarColors | undefined {
  if (avatarDefinition.type !== 'letter') {
    // TODO(Step 3): For image avatars, sample the dominant color from the bitmap.
    return undefined;
  }
  const surface = avatarDefinition.configuration.background as string;
  const contrastWithPage = color(surface).contrast(color(pageBackground));
  if (contrastWithPage < MIN_CONTRAST_RATIO) {
    return undefined;
  }
  return {surface, chonk: darkenAvatarColor(surface)};
}

export function AvatarButton({avatar, size = 'md', ...props}: AvatarButtonProps) {
  const theme = useTheme();

  const avatarDefinition = useAvatar({
    identifier: avatar.identifier,
    name: avatar.name,
    imageDefinition:
      avatar.type === 'upload'
        ? {type: 'upload', uploadUrl: avatar.uploadUrl}
        : avatar.type === 'gravatar'
          ? {type: 'gravatar', gravatarId: avatar.gravatarId}
          : undefined,
  });

  const avatarColors = getAvatarColors(avatarDefinition, theme.tokens.background.primary);

  return (
    <StyledAvatarButton
      {...props}
      size={size}
      surface={avatarColors?.surface ?? ''}
      chonk={avatarColors?.chonk ?? ''}
    >
      <AvatarContainer size={size}>
        {avatarDefinition.type === 'image' ? (
          <StyledImageAvatar configuration={avatarDefinition.configuration} />
        ) : (
          <StyledLetterAvatar configuration={avatarDefinition.configuration} />
        )}
      </AvatarContainer>
    </StyledAvatarButton>
  );
}

const AvatarContainer = styled('div')<{size: NonNullable<ButtonProps['size']>}>`
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: ${p =>
    p.size === 'md'
      ? p.theme.radius.lg
      : p.size === 'sm'
        ? p.theme.radius.md
        : p.size === 'xs'
          ? p.theme.radius.sm
          : p.theme.radius.xs};
`;

const StyledImageAvatar = styled(ImageAvatar)`
  width: 100%;
  height: 100%;
  border-radius: 0;
  position: relative;
`;
const StyledLetterAvatar = styled(LetterAvatar)`
  width: 100%;
  height: 100%;
  border-radius: 0;
  position: relative;
`;

// Elevation per size, matching the base button's chonk depth.
const AVATAR_BUTTON_ELEVATION: Record<string, string> = {
  md: '2px',
  sm: '2px',
  xs: '1px',
};

const StyledAvatarButton = styled(Button)<{surface: string; chonk: string}>`
  padding: 0;
  width: ${p => (p.size === 'zero' ? '24px' : p.theme.form[p.size ?? 'md'].height)};
  min-width: ${p => (p.size === 'zero' ? '24px' : p.theme.form[p.size ?? 'md'].height)};

  ${p =>
    p.surface &&
    p.chonk &&
    `
    &::before {
      background: ${p.chonk};
      box-shadow: 0 ${AVATAR_BUTTON_ELEVATION[p.size ?? 'md'] ?? '2px'} 0 0px ${p.chonk};
    }
    &::after {
      background: ${p.surface};
      border-color: ${p.chonk};
    }
  `}
`;
