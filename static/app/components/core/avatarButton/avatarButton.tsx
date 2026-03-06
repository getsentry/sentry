import {useCallback, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import color from 'color';

import type {BaseAvatarProps} from '@sentry/scraps/avatar';
import {ImageAvatar, LetterAvatar, useAvatar} from '@sentry/scraps/avatar';
import {Button, type ButtonProps} from '@sentry/scraps/button';

import {saturatedAverageSampler, type AvatarColorSampler} from './sampleAvatarColor';

interface AvatarButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'priority'> {
  'aria-label': string;
  avatar: BaseAvatarProps;
  /**
   * Sampling strategy used to extract a representative color from image
   * avatars (uploads, gravatars). Defaults to saturatedAverageSampler.
   * Pass a different implementation to compare strategies.
   */
  sampler?: AvatarColorSampler;
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
 * Shifts a color toward deeper contrast with the page background for use as
 * the chonk (shadow/base) layer of the button:
 * - Light theme (bright background): darkens the color
 * - Dark theme (dark background): lightens the color
 */
function adjustColorForChonk(c: string, pageBackground: string): string {
  const isLightTheme = color(pageBackground).luminosity() > 0.5;
  return isLightTheme ? color(c).darken(0.35).hex() : color(c).lighten(0.35).hex();
}

/**
 * Derives button chonk color from an avatar definition.
 * Returns undefined when no suitable color is available or when the derived
 * color has insufficient contrast with the page background, so the button
 * falls back to its default neutral styling.
 */
function getAvatarColors(
  avatarDefinition: ReturnType<typeof useAvatar>,
  pageBackground: string,
  sampledColor?: string | null
): AvatarColors | undefined {
  let surface: string;

  if (avatarDefinition.type === 'letter') {
    surface = avatarDefinition.configuration.background as string;
  } else if (sampledColor) {
    surface = sampledColor;
  } else {
    return undefined;
  }

  const contrastWithPage = color(surface).contrast(color(pageBackground));
  if (contrastWithPage < MIN_CONTRAST_RATIO) {
    return undefined;
  }
  return {surface, chonk: adjustColorForChonk(surface, pageBackground)};
}

export function AvatarButton({
  avatar,
  size = 'md',
  sampler = saturatedAverageSampler,
  ...props
}: AvatarButtonProps) {
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

  const [sampledColor, setSampledColor] = useState<string | null>(null);

  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      setSampledColor(sampler(event.currentTarget));
    },
    [sampler]
  );

  const avatarColors = getAvatarColors(
    avatarDefinition,
    theme.tokens.background.primary,
    sampledColor
  );

  return (
    <StyledAvatarButton {...props} size={size} chonk={avatarColors?.chonk ?? ''}>
      <AvatarContainer size={size}>
        {avatarDefinition.type === 'image' ? (
          <StyledImageAvatar
            configuration={avatarDefinition.configuration}
            // crossOrigin="anonymous" is required for canvas pixel access in the
            // color sampler. Without it the browser taints the canvas on any
            // cross-origin image, causing getImageData() to throw a SecurityError
            // and readPixels() to silently return null.
            // If the server does not send CORS headers the image will fail to load
            // and useAvatar will fall back to a letter avatar.
            crossOrigin="anonymous"
            onLoad={handleImageLoad}
          />
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

const StyledAvatarButton = styled(Button)<{chonk: string}>`
  padding: 0;
  width: ${p => (p.size === 'zero' ? '24px' : p.theme.form[p.size ?? 'md'].height)};
  min-width: ${p => (p.size === 'zero' ? '24px' : p.theme.form[p.size ?? 'md'].height)};

  ${p =>
    p.chonk &&
    `
    &&::before {
    background: ${p.chonk};
      box-shadow: 0 ${AVATAR_BUTTON_ELEVATION[p.size ?? 'md'] ?? '2px'} 0 0px ${p.chonk};
    }
    &&::after {
      border-color: ${p.chonk};
    }
  `}
`;
