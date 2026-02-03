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

interface GravatarProps extends BaseAvatarStyleProps {
  gravatarId: string;
  remoteSize: number;
  onError?: () => void;
  onLoad?: () => void;
  placeholder?: string;
  ref?: React.Ref<HTMLImageElement>;
}

export function Gravatar({
  ref,
  remoteSize,
  gravatarId,
  placeholder,
  round,
  onError,
  onLoad,
  suggested,
}: GravatarProps) {
  const avatarHash = useGravatarHash(gravatarId);

  if (avatarHash === null) {
    // @TODO(jonasbadalic): Do we need a placeholder here?
    Sentry.captureMessage('Gravatar: avatar hash is undefined');
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
        d: placeholder ?? '404',
      })}`}
      onLoad={onLoad}
      onError={onError}
      suggested={suggested}
    />
  );
}

function useGravatarHash(gravatarId: string) {
  const [avatarHash, setAvatarHash] = useState<string | null>(null);

  useEffect(() => {
    // @TODO(jonasbadalic): why is trim required?
    const trimmedGravatarId = gravatarId.trim();
    if (!trimmedGravatarId) {
      return;
    }

    if (
      !!window.crypto &&
      !!window.crypto.subtle &&
      typeof window.crypto.subtle.digest === 'undefined'
    ) {
      return;
    }

    hashGravatarId(trimmedGravatarId)
      .then(setAvatarHash)
      .catch(error => {
        setAvatarHash(null);
        Sentry.withScope(scope => {
          scope.setFingerprint(['gravatar-hash-error']);
          Sentry.captureException(error);
        });
      });

    return;
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
