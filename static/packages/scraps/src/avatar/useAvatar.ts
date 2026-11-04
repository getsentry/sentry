import {useCallback, useState} from 'react';
import type React from 'react';
import {useTheme} from '@emotion/react';

import type {ImageAvatarProps} from './imageAvatar/imageAvatar';
import type {LetterAvatarProps} from './letterAvatar/letterAvatar';

type LetterAvatarDefinition = {
  configuration: LetterAvatarProps['configuration'];
  type: 'letter';
};

type ImageAvatarDefinition = {
  configuration: ImageAvatarProps['configuration'];
  type: 'image';
};

type AvatarDefinition = LetterAvatarDefinition | ImageAvatarDefinition;

/**
 * Returns either an image or letter avatar definition.
 * When a resolved image URL is provided, attempts to load the image.
 * Falls back to a letter avatar if the image is unavailable or fails to load.
 */
export function useAvatar(options: {
  identifier: string;
  name: string;
  initials?: string;
  src?: string;
}): AvatarDefinition {
  const theme = useTheme();

  const {src, ref} = useImageSrc(options.src);

  if (src !== null) {
    return {
      type: 'image',
      configuration: {
        ref,
        alt: options.name,
        src,
      },
    };
  }

  const {background, content} = theme.swatch.get(options.identifier);

  return {
    type: 'letter',
    configuration: {
      initials: options.initials ?? getInitials(options.name),
      background,
      content,
    },
  };
}

function useImageSrc(resolvedSrc: string | undefined): {
  ref: React.RefCallback<HTMLImageElement>;
  src: string | null;
} {
  const [erroredSrc, setErroredSrc] = useState<string | null>(null);

  // React 19 callback refs can return a cleanup function, so no useEffect needed.
  // Optional chaining ensures no conditional return paths, satisfying consistent-return.
  // Read img.getAttribute('src') at error time rather than a ref to resolvedSrc:
  // resolvedSrcRef.current is updated during the render phase (before commit), so it
  // can be "ahead" of the DOM in React Concurrent Mode. Using the DOM attribute avoids
  // incorrectly marking a new, valid src as errored when an old request fails.
  const ref = useCallback((img: HTMLImageElement | null) => {
    const handleError = () => setErroredSrc(img?.getAttribute('src') ?? null);
    img?.addEventListener('error', handleError);
    return () => img?.removeEventListener('error', handleError);
  }, []);

  return {
    ref,
    src: !resolvedSrc || resolvedSrc === erroredSrc ? null : resolvedSrc,
  };
}

function getInitials(name: string | undefined): string {
  const sanitizedName = name == null ? undefined : String(name).trim();

  if (!sanitizedName) {
    return '?';
  }

  const words = sanitizedName.split(' ');

  // Use Array.from as slicing and substring() work on ucs2 segments which
  // results in only getting half of any 4+ byte character.

  let initials = Array.from(words[0] ?? '')[0] ?? '';
  if (words.length > 1) {
    initials += Array.from(words[words.length - 1] ?? '')[0] ?? '';
  }
  return initials.toUpperCase();
}
