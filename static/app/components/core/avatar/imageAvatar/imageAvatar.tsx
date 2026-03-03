import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import * as qs from 'query-string';

import {Image} from '@sentry/scraps/image';

import ConfigStore from 'sentry/stores/configStore';

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import {baseAvatarStyles, type BaseAvatarStyleProps} from '../avatarComponentStyles';
// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import {LetterAvatar} from '../letterAvatar/letterAvatar';

type GravatarProps = {
  gravatarId: string;
  type: 'gravatar';
};

type ImageProps = {
  src: string;
  type: 'image';
};

/**
 * Note that avatars currently do not support refs. This is because they are only exposed
 * through the main Avatar component, which wraps the avatar in a container element, and has
 * histrically hijacked the ref and attached it to the container element, and we would need
 * to eliminate the wrapper before we can enable ref support.
 */
function useImageAvatar(definition: GravatarProps | ImageProps): {
  ref: React.RefCallback<HTMLImageElement>;
  src: string | null;
} {
  const gravatarHash = useGravatarHash(
    definition.type === 'gravatar' ? definition.gravatarId : null
  );

  const resolvedSrc =
    definition.type === 'gravatar'
      ? gravatarHash
        ? `${ConfigStore.get('gravatarBaseUrl')}/avatar/${gravatarHash}?${qs.stringify({
            // Default remote size to 120px
            s: 120,
            // If gravatar is not found we need the request to return an error,
            // otherwise error handler will not trigger and avatar will not display a LetterAvatar backup.
            d: '404',
          })}`
        : null
      : definition.src || null;

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

function useGravatarHash(gravatarId: string | null): string | null {
  const [avatarHash, setAvatarHash] = useState<string | null>(null);

  useEffect(() => {
    if (gravatarId === null) {
      setAvatarHash(null);
      return;
    }

    const trimmedGravatarId = gravatarId.trim();
    if (!trimmedGravatarId || typeof window.crypto?.subtle?.digest === 'undefined') {
      setAvatarHash(null);
      return;
    }

    hashGravatarId(trimmedGravatarId)
      .then(hash => setAvatarHash(hash))
      .catch(err => {
        setAvatarHash(null);
        Sentry.withScope(scope => {
          scope.setFingerprint(['gravatar-hash-error']);
          Sentry.captureException(err);
        });
      });
  }, [gravatarId]);

  return avatarHash;
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

interface ImageAvatarProps extends BaseAvatarStyleProps {
  definition: GravatarProps | ImageProps;
  identifier: string;
  name: string;
}

export function ImageAvatar({definition, identifier, name, ...props}: ImageAvatarProps) {
  const {ref, src} = useImageAvatar(definition);

  if (!src) {
    return <LetterAvatar identifier={identifier} name={name} {...props} />;
  }

  return <StyledImage ref={ref} src={src} alt={name} {...props} />;
}

const StyledImage = styled(Image)<BaseAvatarStyleProps>`
  ${baseAvatarStyles};
`;
