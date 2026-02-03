import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import * as qs from 'query-string';

import ConfigStore from 'sentry/stores/configStore';

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import {
  baseAvatarStyles,
  type BaseAvatarStyleProps,
} from '../baseAvatar/baseAvatarComponentStyles';

interface GravatarProps
  extends BaseAvatarStyleProps,
    React.ImgHTMLAttributes<HTMLImageElement> {
  gravatarId: string;
  remoteSize: number;
  ref?: React.Ref<HTMLImageElement>;
}

export function Gravatar({
  ref,
  remoteSize,
  gravatarId,
  round,
  suggested,
  ...props
}: GravatarProps) {
  const avatarHash = useGravatarHash(gravatarId);

  if (avatarHash === null) {
    // Calling onError triggers the fallback to a LetterAvatar... This logic here should be inverted with each
    // avatar type accepting a fallback avatar as opposed to bubbling the events up to the parent.
    setTimeout(
      () =>
        props.onError?.(new Error('Sha256 hash not found or missing gravatarId') as any),
      0
    );
    return null;
  }

  return (
    <Image
      ref={ref}
      round={round}
      src={`${ConfigStore.get('gravatarBaseUrl')}/avatar/${avatarHash}?${qs.stringify({
        s: remoteSize,
        // If gravatar is not found we need the request to return an error,
        // otherwise error handler will not trigger and avatar will not have a display a LetterAvatar backup.
        d: '404',
      })}`}
      suggested={suggested}
      {...props}
    />
  );
}

function useGravatarHash(gravatarId: string) {
  const [avatarHash, setAvatarHash] = useState<string | null>(null);

  useEffect(() => {
    const trimmedGravatarId = gravatarId.trim();
    if (!trimmedGravatarId || typeof window.crypto?.subtle?.digest === 'undefined') {
      setAvatarHash(null);
      return;
    }

    hashGravatarId(trimmedGravatarId)
      .then(hash => setAvatarHash(hash))
      .catch(error => {
        setAvatarHash(null);
        Sentry.withScope(scope => {
          scope.setFingerprint(['gravatar-hash-error']);
          Sentry.captureException(error);
        });
      });
  }, [gravatarId]);

  return avatarHash;
}

/**
 * Available only in secure contexts. (https)
 * Gravatar will not work in http
 */
async function hashGravatarId(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const Image = styled('img')<BaseAvatarStyleProps>`
  ${baseAvatarStyles};
`;
