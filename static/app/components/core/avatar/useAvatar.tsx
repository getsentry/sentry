import {useCallback, useState} from 'react';
import type React from 'react';
import {useTheme} from '@emotion/react';
import * as Sentry from '@sentry/react';
import {useQuery} from '@tanstack/react-query';
import color from 'color';
import * as qs from 'query-string';

import ConfigStore from 'sentry/stores/configStore';
import type {Theme} from 'sentry/utils/theme';

type GravatarDefinition = {gravatarId: string; type: 'gravatar'};
type UploadDefinition = {type: 'upload'; uploadUrl: string};
type ImageDefinition = GravatarDefinition | UploadDefinition;

type LetterAvatarDefinition = {
  avatarColor: {background: string; content: string};
  initials: string;
  type: 'letter';
};

type ImageAvatarDefinition = {
  ref: React.RefCallback<HTMLImageElement>;
  src: string;
  type: 'image';
};

type AvatarDefinition = LetterAvatarDefinition | ImageAvatarDefinition;

/**
 * Returns either an image or letter avatar definition.
 * When an imageDefinition is provided, attempts to load the image.
 * Falls back to a letter avatar if the image is unavailable or fails to load.
 */
export function useAvatar(options: {
  identifier: string;
  name: string;
  imageDefinition?: ImageDefinition;
}): AvatarDefinition {
  const theme = useTheme();

  const {src, ref} = useImageSrc(options.imageDefinition);

  if (src !== null) {
    return {type: 'image', src, ref};
  }

  return {
    type: 'letter',
    initials: getInitials(options.name),
    avatarColor: getColor(options.identifier, theme),
  };
}

const DEFAULT_REMOTE_SIZE = 120;

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

function useImageSrc(definition?: ImageDefinition): {
  ref: React.RefCallback<HTMLImageElement>;
  src: string | null;
} {
  const trimmedGravatarId =
    definition?.type === 'gravatar' ? definition.gravatarId.trim() : '';

  const {data: avatarHash} = useQuery({
    queryKey: ['gravatar', trimmedGravatarId],
    queryFn: () => {
      if (!trimmedGravatarId || typeof window.crypto?.subtle?.digest === 'undefined') {
        return null;
      }
      return hashGravatarId(trimmedGravatarId).catch(err => {
        Sentry.withScope(scope => {
          scope.setFingerprint(['gravatar-hash-error']);
          Sentry.captureException(err);
        });
        return null;
      });
    },
    retry: 0,
    staleTime: Infinity,
    networkMode: 'always',
  });

  const gravatarHash = avatarHash ?? null;

  const resolvedSrc = definition
    ? definition.type === 'gravatar'
      ? gravatarHash
        ? `${ConfigStore.get('gravatarBaseUrl')}/avatar/${gravatarHash}?${qs.stringify({
            // Default remote size to 120px
            s: 120,
            // If gravatar is not found we need the request to return an error,
            // otherwise error handler will not trigger and avatar will not display a LetterAvatar backup.
            d: '404',
          })}`
        : null
      : buildUploadUrl(definition.uploadUrl) || null
    : null;

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
    src: resolvedSrc === erroredSrc ? null : resolvedSrc,
  };
}

/**
 * Hashes a gravatar identifier using SHA-256.
 * Gravatars require HTTPS to work.
 */
async function hashGravatarId(gravatarId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(gravatarId);
  const hash = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Also see avatar.py. Anything changed in this file (how colors are selected,
 * the svg, etc) will also need to be changed there.
 */
function getInitials(name: string | undefined): string {
  const sanitizedName = name?.trim();

  if (!sanitizedName) {
    return '?';
  }

  // Special case for data-scrubbed names
  if (sanitizedName === '[Filtered]') {
    return '?';
  }

  const words = sanitizedName.split(' ');

  // Use Array.from as slicing and substring() work on ucs2 segments which
  // results in only getting half of any 4+ byte character.
  let initials = Array.from(words[0]!)[0]!;
  if (words.length > 1) {
    initials += Array.from(words[words.length - 1]!)[0]!;
  }
  return initials.toUpperCase();
}

/**
 * Generates a numeric hash from a string identifier for consistent color selection
 */
function hashIdentifier(identifier: string): number {
  const str = String(identifier);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash += str.charCodeAt(i);
  }
  return hash;
}

function getColor(
  identifier: string | undefined,
  theme: Theme
): {background: string; content: string} {
  const colors = makeLetterAvatarColors(theme);
  if (identifier === undefined) {
    return colors[0]!;
  }
  const id = hashIdentifier(identifier);
  return colors[id % colors.length]!;
}

function makeLetterAvatarColors(theme: Theme) {
  return theme.chart.getColorPalette(9).map(c => ({
    background: c,
    content: color(c).isDark()
      ? theme.tokens.content.onVibrant.light
      : theme.tokens.content.onVibrant.dark,
  }));
}
