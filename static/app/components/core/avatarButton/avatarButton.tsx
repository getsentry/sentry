import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import color from 'color';

import type {BaseAvatarProps} from '@sentry/scraps/avatar';
import {ImageAvatar, LetterAvatar, useAvatar} from '@sentry/scraps/avatar';
import {Button, type ButtonProps} from '@sentry/scraps/button';

import {useQuery} from 'sentry/utils/queryClient';

interface AvatarButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'priority'> {
  'aria-label': string;
  avatar: BaseAvatarProps;
  size?: Exclude<ButtonProps['size'], 'zero'>;
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

  const pageBackground = theme.tokens.background.primary;

  const imageUrl =
    avatarDefinition.type === 'image'
      ? (avatarDefinition.configuration.src as string)
      : null;

  const {data: imageResult = null} = useQuery({
    queryKey: ['avatar-color', imageUrl, pageBackground],
    queryFn: () => resolveImageAvatarColors(imageUrl!, pageBackground),
    enabled: !!imageUrl,
    staleTime: Infinity,
  });

  if (avatarDefinition.type === 'letter') {
    return (
      <StyledAvatarButton
        {...props}
        size={size}
        chonk={
          getLetterAvatarColors(
            avatarDefinition.configuration.background as string,
            pageBackground
          )?.chonk ?? ''
        }
      >
        <AvatarContainer size={size} padded={false}>
          <StyledLetterAvatar configuration={avatarDefinition.configuration} />
        </AvatarContainer>
      </StyledAvatarButton>
    );
  }

  return (
    <StyledAvatarButton {...props} size={size} chonk={imageResult?.chonk ?? ''}>
      <AvatarContainer size={size} padded={imageResult?.style === 'padded'}>
        <StyledImageAvatar configuration={avatarDefinition.configuration} />
      </AvatarContainer>
    </StyledAvatarButton>
  );
}

const AvatarContainer = styled('div')<{
  size: NonNullable<ButtonProps['size']>;
  padded?: boolean;
}>`
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
  padding: ${p => (p.padded ? '12%' : '0')};
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

function getLetterAvatarColors(
  surface: string,
  pageBackground: string
): {chonk: string | undefined} | undefined {
  const contrastWithPage = color(surface).contrast(color(pageBackground));
  if (contrastWithPage < 1.3) {
    return undefined;
  }
  const isLightTheme = color(pageBackground).luminosity() > 0.5;
  return {
    chonk: isLightTheme
      ? color(surface).darken(0.35).hex()
      : color(surface).lighten(0.35).hex(),
  };
}

// Checks the alpha channel of each edge pixel to determine if the image should be padded.
// If any edge pixel is opaque, the image should be padded.
function shouldPadImage(data: Uint8ClampedArray): 'fill' | 'padded' {
  // prettier-ignore
  if (!(data[3]!>=128   || data[51]!>=128  || data[99]!>=128  ||
        data[147]!>=128 || data[195]!>=128 || data[243]!>=128 ||
        data[291]!>=128 || data[339]!>=128 || data[387]!>=128 ||
        data[435]!>=128 || data[483]!>=128 || data[531]!>=128)) return 'padded';
  // prettier-ignore
  if (!(data[47]!>=128  || data[95]!>=128  || data[143]!>=128 ||
        data[191]!>=128 || data[239]!>=128 || data[287]!>=128 ||
        data[335]!>=128 || data[383]!>=128 || data[431]!>=128 ||
        data[479]!>=128 || data[527]!>=128 || data[575]!>=128)) return 'padded';
  // prettier-ignore
  if (!(data[3]!>=128  || data[7]!>=128  || data[11]!>=128 ||
        data[15]!>=128 || data[19]!>=128 || data[23]!>=128 ||
        data[27]!>=128 || data[31]!>=128 || data[35]!>=128 ||
        data[39]!>=128 || data[43]!>=128 || data[47]!>=128)) return 'padded';
  // prettier-ignore
  if (!(data[531]!>=128 || data[535]!>=128 || data[539]!>=128 ||
        data[543]!>=128 || data[547]!>=128 || data[551]!>=128 ||
        data[555]!>=128 || data[559]!>=128 || data[563]!>=128 ||
        data[567]!>=128 || data[571]!>=128 || data[575]!>=128)) return 'padded';
  if (!(data[3]! >= 128 && data[47]! >= 128 && data[531]! >= 128 && data[575]! >= 128))
    return 'padded';

  return 'fill';
}

function readPixels(img: HTMLImageElement): Uint8ClampedArray | null {
  const SAMPLE_SIZE = 12;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw the image on a 12x12 canvas to make the sampling more efficient
    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    let drawW = SAMPLE_SIZE;
    let drawH = SAMPLE_SIZE;
    let offsetX = 0;
    let offsetY = 0;
    if (naturalW > 0 && naturalH > 0) {
      const scale = Math.min(SAMPLE_SIZE / naturalW, SAMPLE_SIZE / naturalH);
      drawW = naturalW * scale;
      drawH = naturalH * scale;
      offsetX = (SAMPLE_SIZE - drawW) / 2;
      offsetY = (SAMPLE_SIZE - drawH) / 2;
    }

    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    return ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
  } catch {
    return null;
  }
}

function sampleAvatarColor(img: HTMLImageElement): {
  hex: string | null;
  style: 'fill' | 'padded';
} | null {
  const data = readPixels(img);

  if (!data) return null;

  let r = 0,
    g = 0,
    b = 0,
    count = 0;

  for (let i = 0; i < data.length; i += 4) {
    // if (data[i + 3]! < 128) continue;
    const pr = data[i]!,
      pg = data[i + 1]!,
      pb = data[i + 2]!;

    // 0.15 is minimum saturation for a pixel to count as chromatic
    if ((Math.max(pr, pg, pb) - Math.min(pr, pg, pb)) / 255 < 0.15) continue;
    r += pr;
    g += pg;
    b += pb;
    count++;
  }

  const style = shouldPadImage(data);
  if (count === 0) return {hex: null, style};

  return {
    hex:
      '#' +
      Math.round(r / count)
        .toString(16)
        .padStart(2, '0') +
      Math.round(g / count)
        .toString(16)
        .padStart(2, '0') +
      Math.round(b / count)
        .toString(16)
        .padStart(2, '0'),
    style,
  };
}

function fetchAvatarColor(
  url: string
): Promise<ReturnType<typeof sampleAvatarColor> | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(sampleAvatarColor(img));
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function resolveImageAvatarColors(
  url: string,
  pageBackground: string
): Promise<{chonk: string | undefined; style: 'fill' | 'padded'} | null> {
  const sampled = await fetchAvatarColor(url);

  if (!sampled) return null;

  return {
    chonk: sampled.hex
      ? color(pageBackground).luminosity() > 0.5
        ? color(sampled.hex).darken(0.35).hex()
        : color(sampled.hex).lighten(0.35).hex()
      : undefined,
    style: sampled.style,
  };
}
